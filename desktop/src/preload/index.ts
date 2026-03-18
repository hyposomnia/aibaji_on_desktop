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
})
