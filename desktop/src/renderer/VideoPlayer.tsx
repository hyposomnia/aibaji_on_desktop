import { useEffect, useRef } from 'react'

// 扩展 Window 类型以支持 electronAPI
declare global {
  interface Window {
    electronAPI: {
      onPlayVideo: (callback: (path: string) => void) => void
      onPlayAudio: (callback: (base64: string) => void) => void
      onUpdateLockState: (callback: (locked: boolean) => void) => void
      sendVideoEnded: () => void
      getConfig: () => Promise<unknown>
      setConfig: (partial: unknown) => Promise<void>
      setIgnoreMouseEvents: (ignore: boolean) => void
      updateWindowConfig: (updates: { scale?: number; opacity?: number; locked?: boolean }) => void
      getCharacters: () => Promise<unknown>
      getOutfits: (char: string) => Promise<unknown>
      setCharacter: (char: string, outfit: string) => void
      selectFolder: () => Promise<unknown>
      openSettings: () => void
      onNeedSetup: (callback: () => void) => void
      sendSetupComplete: () => void
      quit: () => void
      getAutostart: () => Promise<boolean>
      setAutostart: (enabled: boolean) => Promise<void>
      centerWindow: () => void
    }
  }
}

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lockedRef = useRef(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    // 初始化拖拽区域（读取 config 中的 locked 状态）
    api.getConfig().then((cfg) => {
      const c = cfg as Record<string, unknown>
      const win = (c.window as Record<string, unknown>) || {}
      const locked = !!win.locked
      lockedRef.current = locked
      document.body.style.webkitAppRegion = locked ? 'no-drag' : 'drag'
    })

    // 监听播放视频指令
    api.onPlayVideo((path: string) => {
      const video = videoRef.current
      if (!video) return
      video.src = encodeURI(`file://${path}`)
      video.play().catch((e) => {
        if (e.name !== 'AbortError') console.error('video play error:', e)
      })
    })

    // 监听播放音频指令（base64 mp3）
    api.onPlayAudio((base64: string) => {
      console.log(`[aibaji] renderer: play-audio received, base64 length=${base64.length}`)
      const audio = new Audio(`data:audio/mpeg;base64,${base64}`)
      audio.play().then(() => {
        console.log('[aibaji] renderer: audio playing OK')
      }).catch((e) => {
        console.error('[aibaji] renderer: audio play error', e)
      })
    })

    // 监听锁定状态变化
    api.onUpdateLockState((locked: boolean) => {
      lockedRef.current = locked
      document.body.style.webkitAppRegion = locked ? 'no-drag' : 'drag'
    })

    // 所有 IPC 监听已注册，通知 main 进程可以开始播放
    api.notifyReady()
  }, [])

  const handleVideoEnded = () => {
    window.electronAPI?.sendVideoEnded()
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    >
      <video
        ref={videoRef}
        onEnded={handleVideoEnded}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: 'transparent',
        }}
        playsInline
      />
    </div>
  )
}
