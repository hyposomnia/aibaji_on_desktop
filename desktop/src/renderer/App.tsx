import { useState } from 'react'
import VideoPlayer, { type ContextMenuPos } from './VideoPlayer'
import FloatingMenu from './FloatingMenu'
import SettingsPage from './SettingsPage'

export default function App() {
  const [menuPos, setMenuPos] = useState<ContextMenuPos | null>(null)

  // 设置页面（独立窗口加载同一 index.html#settings）
  if (window.location.hash === '#settings') {
    return <SettingsPage />
  }

  return (
    <>
      <VideoPlayer onContextMenu={(pos) => setMenuPos(pos)} />
      {menuPos && (
        <FloatingMenu x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)} />
      )}
    </>
  )
}
