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
      randomOutfit: () => void
      getWindowPosition: () => Promise<{ x: number; y: number }>
      startDrag: (startMouseX: number, startMouseY: number) => void
      stopDrag: () => void
      notifyReady: () => void
    }
  }
}

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lockedRef = useRef(false)

  // 自定义拖拽状态（窗口实际移动由 main 进程轮询处理，renderer 只追踪 moved 用于区分点击和拖拽）
  const dragRef = useRef<{
    dragging: boolean
    startMouseX: number
    startMouseY: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    // 始终使用自定义拖拽，禁用 webkit-app-region
    document.body.style.webkitAppRegion = 'no-drag'

    // 读取初始锁定状态
    api.getConfig().then((cfg) => {
      const c = cfg as Record<string, unknown>
      const win = (c.window as Record<string, unknown>) || {}
      lockedRef.current = !!win.locked
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
    })

    // 自定义拖拽：renderer 只追踪 moved 标志，窗口实际移动由 main 进程轮询完成
    // 这样即使鼠标跑出窗口上边界（大窗口高速上拖时的常见问题）也不影响拖拽
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag || !drag.dragging) return
      const dx = e.screenX - drag.startMouseX
      const dy = e.screenY - drag.startMouseY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        drag.moved = true
      }
    }

    const handleMouseUp = () => {
      if (dragRef.current) api.stopDrag()
      dragRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    // 所有 IPC 监听已注册，通知 main 进程可以开始播放
    api.notifyReady()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleVideoEnded = () => {
    window.electronAPI?.sendVideoEnded()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (lockedRef.current) return
    const api = window.electronAPI
    if (!api) return
    dragRef.current = {
      dragging: true,
      startMouseX: e.screenX,
      startMouseY: e.screenY,
      moved: false,
    }
    // 通知 main 进程开始拖拽轮询，由其直接调用 screen.getCursorScreenPoint() 移动窗口
    api.startDrag(e.screenX, e.screenY)
  }

  const handleDoubleClick = () => {
    const drag = dragRef.current
    // 拖拽过程中不触发双击
    if (drag?.moved) return
    if (!lockedRef.current) {
      window.electronAPI?.randomOutfit()
    }
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'transparent',
        cursor: 'default',
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
          pointerEvents: 'none',
        }}
        playsInline
      />
    </div>
  )
}
