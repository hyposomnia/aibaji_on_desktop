import { BrowserWindow } from 'electron'
import * as path from 'path'

let settingsWindow: BrowserWindow | null = null

export function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 620,
    title: '爱巴基设置',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !process.env.ELECTRON_RENDERER_URL,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    settingsWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#settings`)
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      hash: 'settings',
    })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}
