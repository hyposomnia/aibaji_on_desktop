import { useEffect, useRef } from 'react'

export interface ContextMenuPos {
  x: number
  y: number
}

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
      quit: () => void
    }
  }
}

interface Props {
  onContextMenu: (pos: ContextMenuPos) => void
}

export default function VideoPlayer({ onContextMenu }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lockedRef = useRef(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    // 鼠标进入窗口：停止穿透，允许拖拽和点击
    const onMouseMove = () => {
      api.setIgnoreMouseEvents(false)
    }
    // 鼠标离开窗口：恢复穿透（非锁定模式）
    const onMouseLeave = () => {
      if (!lockedRef.current) {
        api.setIgnoreMouseEvents(true)
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)

    // 监听播放视频指令
    api.onPlayVideo((path: string) => {
      const video = videoRef.current
      if (!video) return
      video.src = encodeURI(`file://${path}`)
      video.play().catch((e) => {
        // AbortError 是正常现象（新 src 打断了上一个 play()），忽略
        if (e.name !== 'AbortError') console.error('video play error:', e)
      })
    })

    // 监听播放音频指令（base64 mp3）
    api.onPlayAudio((base64: string) => {
      const audio = new Audio(`data:audio/mpeg;base64,${base64}`)
      audio.play().catch(console.error)
    })

    // 监听锁定状态变化
    api.onUpdateLockState((locked: boolean) => {
      lockedRef.current = locked
      document.body.style.webkitAppRegion = locked ? 'no-drag' : 'drag'
    })

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  const handleVideoEnded = () => {
    window.electronAPI?.sendVideoEnded()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenu({ x: e.clientX, y: e.clientY })
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
        onContextMenu={handleContextMenu}
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
