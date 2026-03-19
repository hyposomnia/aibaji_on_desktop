import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 视频播放
  onPlayVideo: (callback: (path: string) => void) => {
    ipcRenderer.on('play-video', (_event, path) => callback(path))
  },
  // 音频播放
  onPlayAudio: (callback: (base64: string) => void) => {
    ipcRenderer.on('play-audio', (_event, base64) => callback(base64))
  },
  // 锁定状态更新
  onUpdateLockState: (callback: (locked: boolean) => void) => {
    ipcRenderer.on('update-lock-state', (_event, locked) => callback(locked))
  },
  // 视频播放结束通知
  sendVideoEnded: () => {
    ipcRenderer.send('video-ended')
  },
  // 配置管理
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (partial: unknown) => ipcRenderer.invoke('set-config', partial),
  // 鼠标穿透控制
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse-events', ignore),
  // 窗口配置（触发实际窗口变化）
  updateWindowConfig: (updates: { scale?: number; opacity?: number; locked?: boolean }) =>
    ipcRenderer.send('update-window-config', updates),
  // 角色管理
  getCharacters: () => ipcRenderer.invoke('get-characters'),
  getOutfits: (char: string) => ipcRenderer.invoke('get-outfits', char),
  setCharacter: (char: string, outfit: string) => ipcRenderer.send('set-character', char, outfit),
  // 文件夹选择
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  // 设置窗口
  openSettings: () => ipcRenderer.send('open-settings'),
  // 首次启动 setup
  onNeedSetup: (callback: () => void) => {
    ipcRenderer.once('need-setup', callback)
  },
  sendSetupComplete: () => ipcRenderer.send('setup-complete'),
  // 退出
  quit: () => ipcRenderer.send('quit'),
})
