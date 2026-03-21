import { app, ipcMain, dialog } from 'electron'
import * as path from 'path'
import { initStore, getConfig, setConfig, registerHandlers as registerStoreHandlers } from './store'
import { getCharacters, getOutfits, getEmotions } from './characterLoader'
import { createWindow, getMainWindow, registerWindowHandlers } from './window'
import { startServer, onEvent, stopServer } from './server'
import { initTray, refreshTray } from './tray'
import { initVideoQueue, onVideoEnded, enqueueEmotion, setCharacterOutfit } from './videoQueue'
import { processEvent, resolveCharacterLLM } from './llm'
import { synthesize } from './tts'
import { openSettings } from './settings'

// 防止重复初始化
app.disableHardwareAcceleration() // 透明窗口需要禁用硬件加速（部分平台）

async function bootstrap(): Promise<void> {
  // 1. 初始化 store
  await initStore()

  // 应用开机自启动设置（默认开启）
  const autostartConfig = getConfig()
  app.setLoginItemSettings({ openAtLogin: autostartConfig.autostart })

  // 2. 创建透明悬浮窗口
  const win = createWindow()

  // 3. 启动 HTTP 服务
  await startServer()

  // 4. 创建系统托盘
  initTray()

  // 5. 注册 IPC handlers（提前注册，setup 期间 renderer 需要 select-folder / set-config）
  registerStoreHandlers()
  registerWindowHandlers()
  registerAdditionalHandlers()

  // 6. 提前注册 renderer-ready Promise，避免错过事件
  const rendererReady = new Promise<void>((resolve) => {
    ipcMain.once('renderer-ready', () => resolve())
  })

  // 7. 等待窗口加载完成
  await new Promise<void>((resolve) => {
    win.webContents.once('did-finish-load', resolve)
  })

  // 8. 若 dataPath 为空，通知 renderer 显示 setup 弹窗，等待用户完成
  let config = getConfig()
  if (!config.character.dataPath) {
    win.webContents.send('need-setup')
    await new Promise<void>((resolve) => {
      ipcMain.once('setup-complete', () => resolve())
    })
    config = getConfig()
  }

  const dataPath = config.character.dataPath
  if (!dataPath) {
    app.quit()
    return
  }

  // 9. 如果角色未选择，自动选择第一个
  let { name: charName, outfit: charOutfit } = config.character
  console.log('[aibaji] dataPath:', dataPath, 'charName:', charName)
  if (!charName) {
    const chars = getCharacters(dataPath)
    console.log('[aibaji] available chars:', chars)
    if (chars.length > 0) {
      charName = chars[0]
      const outfits = getOutfits(dataPath, charName)
      charOutfit = outfits.length > 0 ? outfits[0] : ''
      console.log('[aibaji] auto-selected:', charName, charOutfit)
      setConfig({ character: { ...config.character, name: charName, outfit: charOutfit } })
    }
  }

  // 9. 等待 renderer IPC 监听注册完毕，再初始化视频队列
  await rendererReady
  initVideoQueue(win, dataPath, charName, charOutfit)
  // dev 热更新后重新触发 idle
  if (process.env.ELECTRON_RENDERER_URL) {
    win.webContents.on('did-finish-load', () => {
      setCharacterOutfit(charName, charOutfit)
    })
  }

  // 11. 刷新托盘（显示正确角色列表）
  refreshTray()

  // 12. 监听 HTTP 事件 → LLM → 视频队列
  onEvent(async (eventData) => {
    const currentConfig = getConfig()
    const { name: char, outfit, dataPath: dp } = currentConfig.character
    const emotions = getEmotions(dp, char, outfit)
    const { profile, persona } = resolveCharacterLLM(char)
    console.log(`[aibaji] event received: ${eventData.event ?? eventData.hook_event_name}, message="${eventData.message}", char=${char}, emotions=${emotions.length}, profile=${profile?.name ?? 'none(fallback)'}`)
    await processEvent(
      eventData,
      emotions,
      {
        onEmotion: (emotion) => {
          // 收到事件时禁用平静表情（与 idle 无法区分），强制换成其他表情
          const nonCalm = emotions.filter((e) => !e.startsWith('平静'))
          const finalEmotion = emotion.startsWith('平静') && nonCalm.length > 0
            ? nonCalm[Math.floor(Math.random() * nonCalm.length)]
            : emotion
          enqueueEmotion(finalEmotion)
        },
        onText: (text) => {
          console.log(`[aibaji] onText: "${text.slice(0, 30)}..."`)
          const currentWin = getMainWindow()
          if (currentWin && text) {
            synthesize(text, currentWin, char).catch((err) => {
              console.error('[aibaji] TTS error:', err)
            })
          }
        },
      },
      profile,
      persona
    )
  })
}

/**
 * 注册额外的 IPC handlers
 */
function registerAdditionalHandlers(): void {
  // 视频播放完成
  ipcMain.on('video-ended', () => {
    onVideoEnded()
  })

  // 获取角色列表
  ipcMain.handle('get-characters', () => {
    const config = getConfig()
    return getCharacters(config.character.dataPath)
  })

  // 获取服装列表
  ipcMain.handle('get-outfits', (_, char: string) => {
    const config = getConfig()
    return getOutfits(config.character.dataPath, char)
  })

  // 获取表情列表
  ipcMain.handle('get-emotions', (_, char: string, outfit: string) => {
    const config = getConfig()
    return getEmotions(config.character.dataPath, char, outfit)
  })

  // 选择文件夹
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择文件夹',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // 切换角色/服装
  ipcMain.on('set-character', (_, char: string, outfit: string) => {
    const config = getConfig()
    setConfig({ character: { ...config.character, name: char, outfit } })
    setCharacterOutfit(char, outfit)
    refreshTray()
  })

  // 随机切换服装（双击角色触发）
  ipcMain.on('random-outfit', () => {
    const config = getConfig()
    const { name: char, outfit: current, dataPath } = config.character
    if (!char || !dataPath) return
    const outfits = getOutfits(dataPath, char)
    if (outfits.length <= 1) return
    const others = outfits.filter((o) => o !== current)
    const next = others[Math.floor(Math.random() * others.length)]
    setConfig({ character: { ...config.character, outfit: next } })
    setCharacterOutfit(char, next)
    refreshTray()
  })

  // 打开设置窗口
  ipcMain.on('open-settings', () => {
    openSettings()
  })

  // 退出
  ipcMain.on('quit', () => {
    app.quit()
  })

  // 开机自启动
  ipcMain.handle('get-autostart', () => {
    return getConfig().autostart
  })

  ipcMain.handle('set-autostart', (_, enabled: boolean) => {
    setConfig({ autostart: enabled })
    app.setLoginItemSettings({ openAtLogin: enabled })
  })
}

// app 生命周期
app.whenReady().then(async () => {
  await bootstrap()

  app.on('activate', () => {
    const win = getMainWindow()
    if (win) {
      win.show()
    }
  })
})

app.on('window-all-closed', () => {
  // macOS：不退出应用，保持托盘运行
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await stopServer()
})

// 防止多实例
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}
