import { app, dialog, ipcMain } from 'electron'
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
  const config = getConfig()

  // 2. 若 dataPath 为空，提示用户选择角色文件夹
  let dataPath = config.character.dataPath
  if (!dataPath) {
    const result = await dialog.showOpenDialog({
      title: '请选择角色资源文件夹',
      message: '请选择包含角色视频素材的文件夹（如 characters/ 目录）',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      app.quit()
      return
    }
    dataPath = result.filePaths[0]
    setConfig({ character: { ...config.character, dataPath } })
  }

  // 3. 如果角色未选择，自动选择第一个
  const updatedConfig = getConfig()
  let { name: charName, outfit: charOutfit } = updatedConfig.character
  console.log('[aibaji] dataPath:', dataPath, 'charName:', charName)
  if (!charName) {
    const chars = getCharacters(dataPath)
    console.log('[aibaji] available chars:', chars)
    if (chars.length > 0) {
      charName = chars[0]
      const outfits = getOutfits(dataPath, charName)
      charOutfit = outfits.length > 0 ? outfits[0] : ''
      console.log('[aibaji] auto-selected:', charName, charOutfit)
      setConfig({ character: { ...updatedConfig.character, name: charName, outfit: charOutfit } })
    }
  }

  // 4. 创建透明悬浮窗口
  const win = createWindow()

  // 5. 启动 HTTP 服务
  await startServer()

  // 6. 创建系统托盘
  initTray()

  // 7. 初始化视频队列（did-finish-load 内部处理首帧时机）
  initVideoQueue(win, dataPath, charName, charOutfit)
  // dev 热更新后重新触发 idle
  if (process.env.ELECTRON_RENDERER_URL) {
    win.webContents.on('did-finish-load', () => {
      setCharacterOutfit(charName, charOutfit)
    })
  }

  // 8. 注册 IPC handlers
  registerStoreHandlers()
  registerWindowHandlers()
  registerAdditionalHandlers(dataPath)

  // 9. 监听 HTTP 事件 → LLM → 视频队列
  onEvent(async (eventData) => {
    const currentConfig = getConfig()
    const { name: char, outfit, dataPath: dp } = currentConfig.character
    const emotions = getEmotions(dp, char, outfit)
    const { profile, persona } = resolveCharacterLLM(char)
    await processEvent(
      eventData,
      emotions,
      {
        onEmotion: (emotion) => {
          enqueueEmotion(emotion)
        },
        onText: (text) => {
          const currentWin = getMainWindow()
          if (currentWin && text) {
            synthesize(text, currentWin).catch((err) => {
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
function registerAdditionalHandlers(dataPath: string): void {
  // 视频播放完成
  ipcMain.on('video-ended', () => {
    onVideoEnded()
  })

  // 获取角色列表
  ipcMain.handle('get-characters', () => {
    const config = getConfig()
    return getCharacters(config.character.dataPath || dataPath)
  })

  // 获取服装列表
  ipcMain.handle('get-outfits', (_, char: string) => {
    const config = getConfig()
    return getOutfits(config.character.dataPath || dataPath, char)
  })

  // 获取表情列表
  ipcMain.handle('get-emotions', (_, char: string, outfit: string) => {
    const config = getConfig()
    return getEmotions(config.character.dataPath || dataPath, char, outfit)
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

  // 打开设置窗口
  ipcMain.on('open-settings', () => {
    openSettings()
  })

  // 退出
  ipcMain.on('quit', () => {
    app.quit()
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
