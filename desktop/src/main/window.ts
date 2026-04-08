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
  // setAlwaysOnTop 可能导致 macOS 重新约束窗口坐标，恢复预期位置
  if (x !== undefined && y !== undefined) {
    mainWindow.setPosition(x, y)
  }

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
  // 保存当前位置：setSize 可能触发 macOS 重新约束坐标（同 setAlwaysOnTop）
  const [x, y] = mainWindow.getPosition()
  mainWindow.setSize(w, h)
  mainWindow.setPosition(x, y)
  setConfig({ window: { ...config.window, scale } })
}

/**
 * Main 进程拖拽：通过轮询 getCursorScreenPoint 移动窗口
 * 避免依赖 renderer mousemove（大窗口高速拖拽时鼠标会跑出窗口边界导致事件丢失）
 */
let dragState: { startWinX: number; startWinY: number; startMouseX: number; startMouseY: number } | null = null
let dragInterval: ReturnType<typeof setInterval> | null = null

function startWindowDrag(startMouseX: number, startMouseY: number): void {
  if (!mainWindow) return
  const [startWinX, startWinY] = mainWindow.getPosition()
  dragState = { startWinX, startWinY, startMouseX, startMouseY }
  if (dragInterval) clearInterval(dragInterval)
  dragInterval = setInterval(() => {
    if (!dragState || !mainWindow) return
    const cursor = electronScreen.getCursorScreenPoint()
    const dx = cursor.x - dragState.startMouseX
    const dy = cursor.y - dragState.startMouseY
    const newX = Math.round(dragState.startWinX + dx)
    const newY = Math.round(dragState.startWinY + dy)
    mainWindow.setPosition(newX, newY)
  }, 16)
}

function stopWindowDrag(): void {
  dragState = null
  if (dragInterval) {
    clearInterval(dragInterval)
    dragInterval = null
  }
}

/**
 * 将窗口移动到当前光标所在屏幕的正中间
 */
export function centerWindowOnCurrentDisplay(): void {
  if (!mainWindow) return
  const cursor = electronScreen.getCursorScreenPoint()
  const display = electronScreen.getDisplayNearestPoint(cursor)
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea
  const bounds = mainWindow.getBounds()
  const cx = Math.round(dx + (dw - bounds.width) / 2)
  const cy = Math.round(dy + (dh - bounds.height) / 2)
  mainWindow.setPosition(cx, cy)
  setConfig({ window: { ...getConfig().window, x: cx, y: cy } })
}

export function registerWindowHandlers(): void {
  ipcMain.on('center-window', () => {
    centerWindowOnCurrentDisplay()
  })

  ipcMain.handle('get-window-position', () => {
    if (!mainWindow) return { x: 0, y: 0 }
    const [x, y] = mainWindow.getPosition()
    return { x, y }
  })

  ipcMain.on('start-drag', (_, startMouseX: number, startMouseY: number) => {
    startWindowDrag(startMouseX, startMouseY)
  })

  ipcMain.on('stop-drag', () => {
    stopWindowDrag()
  })

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
