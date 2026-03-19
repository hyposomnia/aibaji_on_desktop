import { BrowserWindow, ipcMain, globalShortcut, screen as electronScreen } from 'electron'
import * as path from 'path'
import { getConfig, setConfig } from './store'

let mainWindow: BrowserWindow | null = null

/**
 * 创建透明悬浮窗口
 */
export function createWindow(): BrowserWindow {
  const config = getConfig()
  const { scale, baseWidth, baseHeight, x, y } = config.window

  mainWindow = new BrowserWindow({
    width: Math.round(baseWidth * scale),
    height: Math.round(baseHeight * scale),
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // dev 模式下允许从 localhost 加载 file:// 视频资源
      webSecurity: !process.env.ELECTRON_RENDERER_URL,
    },
  })

  // 始终置顶
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  // dev 模式：Cmd+Shift+I 打开 DevTools
  if (process.env.ELECTRON_RENDERER_URL) {
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    })
  }

  // 关闭时保存位置，避免 setAlwaysOnTop 等初始化事件导致的坐标漂移
  mainWindow.on('close', () => {
    if (!mainWindow) return
    const { x, y } = mainWindow.getBounds()
    setConfig({ window: { ...getConfig().window, x, y } })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 加载渲染进程
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  return mainWindow
}

/**
 * 获取主窗口实例
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * 设置锁定模式
 */
export function setLocked(locked: boolean): void {
  if (!mainWindow) return
  mainWindow.webContents.send('update-lock-state', locked)
  setConfig({ window: { ...getConfig().window, locked } })
}

/**
 * 更新缩放比例
 */
export function updateScale(scale: number): void {
  if (!mainWindow) return
  const config = getConfig()
  const w = Math.round(config.window.baseWidth * scale)
  const h = Math.round(config.window.baseHeight * scale)
  mainWindow.setSize(w, h)
  setConfig({ window: { ...config.window, scale } })
}

/**
 * 注册窗口相关 IPC handlers
 */
export function registerWindowHandlers(): void {
  ipcMain.on('set-ignore-mouse-events', (_, ignore: boolean) => {
    if (mainWindow) {
      if (ignore) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true })
      } else {
        mainWindow.setIgnoreMouseEvents(false)
      }
    }
  })

  ipcMain.on('update-window-config', (_, updates: { scale?: number; opacity?: number; locked?: boolean }) => {
    if (updates.scale !== undefined) {
      updateScale(updates.scale)
    }
    if (updates.locked !== undefined) {
      setLocked(updates.locked)
    }
    if (updates.opacity !== undefined) {
      if (mainWindow) {
        mainWindow.setOpacity(updates.opacity)
        setConfig({ window: { ...getConfig().window, opacity: updates.opacity } })
      }
    }
  })
}
