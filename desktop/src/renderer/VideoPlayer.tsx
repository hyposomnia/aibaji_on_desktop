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
    }
  }
}

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    // 监听播放视频指令
    api.onPlayVideo((path: string) => {
      const video = videoRef.current
      if (!video) return
      video.src = `file://${path}`
      video.play().catch(console.error)
    })

    // 监听播放音频指令（base64 mp3）
    api.onPlayAudio((base64: string) => {
      const audio = new Audio(`data:audio/mpeg;base64,${base64}`)
      audio.play().catch(console.error)
    })

    // 监听锁定状态变化
    api.onUpdateLockState((locked: boolean) => {
      document.body.style.webkitAppRegion = locked ? 'no-drag' : 'drag'
    })
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
