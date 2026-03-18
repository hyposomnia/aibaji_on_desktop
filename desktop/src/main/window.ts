import { BrowserWindow, ipcMain } from 'electron'
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

  // 默认非锁定：鼠标穿透（forward: true 允许拖拽区域仍可接收事件）
  mainWindow.setIgnoreMouseEvents(!config.window.locked, { forward: true })

  // 始终置顶
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  // 关闭时保存位置
  mainWindow.on('moved', () => {
    if (!mainWindow) return
    const [wx, wy] = mainWindow.getPosition()
    setConfig({ window: { ...getConfig().window, x: wx, y: wy } })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 加载渲染进程
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    // dev 模式自动打开 DevTools 便于调试
    mainWindow.webContents.openDevTools({ mode: 'detach' })
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
  if (locked) {
    mainWindow.setIgnoreMouseEvents(false)
  } else {
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  }
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
