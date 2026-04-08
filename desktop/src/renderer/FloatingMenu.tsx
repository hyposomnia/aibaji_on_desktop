import { useState, useEffect } from 'react'

interface Props {
  x: number
  y: number
  onClose: () => void
}

const MENU_WIDTH = 230

export default function FloatingMenu({ x, y, onClose }: Props) {
  const [char, setChar] = useState('')
  const [outfit, setOutfit] = useState('')
  const [characters, setCharacters] = useState<string[]>([])
  const [outfits, setOutfits] = useState<string[]>([])
  const [scale, setScale] = useState(1.0)
  const [opacity, setOpacity] = useState(1.0)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    Promise.all([api.getConfig(), api.getCharacters()]).then(([cfg, chars]) => {
      const c = cfg as Record<string, Record<string, unknown>>
      const win = c.window as { scale: number; opacity: number; locked: boolean }
      const character = c.character as { name: string; outfit: string }
      setChar(character.name)
      setOutfit(character.outfit)
      setScale(win.scale)
      setOpacity(win.opacity)
      setLocked(win.locked)
      setCharacters(chars as string[])
      api.getOutfits(character.name).then((o) => setOutfits(o as string[]))
    })
  }, [])

  const handleCharChange = async (newChar: string) => {
    setChar(newChar)
    const newOutfits = (await window.electronAPI.getOutfits(newChar)) as string[]
    setOutfits(newOutfits)
    const newOutfit = newOutfits[0] || ''
    setOutfit(newOutfit)
    window.electronAPI.setCharacter(newChar, newOutfit)
  }

  const handleOutfitChange = (newOutfit: string) => {
    setOutfit(newOutfit)
    window.electronAPI.setCharacter(char, newOutfit)
  }

  const handleScale = (v: number) => {
    setScale(v)
    window.electronAPI.updateWindowConfig({ scale: v })
  }

  const handleOpacity = (v: number) => {
    setOpacity(v)
    window.electronAPI.updateWindowConfig({ opacity: v })
  }

  const handleLocked = () => {
    const next = !locked
    setLocked(next)
    window.electronAPI.updateWindowConfig({ locked: next })
  }

  // 避免菜单超出屏幕
  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8)
  const top = Math.min(y, window.innerHeight - 380)

  return (
    <>
      {/* 点击外部关闭 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, WebkitAppRegion: 'no-drag' } as React.CSSProperties} onMouseDown={onClose} />
      <div
        style={{
          position: 'fixed',
          left,
          top,
          width: MENU_WIDTH,
          zIndex: 1000,
          WebkitAppRegion: 'no-drag',
          background: 'rgba(18,18,18,0.93)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
          color: '#fff',
          fontSize: 13,
          padding: '6px 0',
          userSelect: 'none',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 角色/服装 */}
        <div style={{ padding: '6px 14px 8px' }}>
          <SelectRow
            label="角色"
            value={char}
            options={characters}
            onChange={handleCharChange}
          />
          <SelectRow
            label="服装"
            value={outfit}
            options={outfits}
            onChange={handleOutfitChange}
          />
        </div>

        <Divider />

        {/* 大小 / 透明度滑块 */}
        <div style={{ padding: '8px 14px' }}>
          <SliderRow
            label="大小"
            value={scale}
            min={0.3}
            max={4.0}
            step={0.05}
            display={`${Math.round(scale * 100)}%`}
            onChange={handleScale}
          />
          <SliderRow
            label="透明度"
            value={opacity}
            min={0.2}
            max={1.0}
            step={0.05}
            display={`${Math.round(opacity * 100)}%`}
            onChange={handleOpacity}
          />
        </div>

        <Divider />

        <MenuItem onClick={handleLocked}>
          <span style={{ opacity: locked ? 1 : 0.3, marginRight: 6 }}>✓</span>锁定模式
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => {
            window.electronAPI.openSettings()
            onClose()
          }}
        >
          设置…
        </MenuItem>

        <Divider />

        <MenuItem onClick={() => window.electronAPI.quit()} danger>
          退出
        </MenuItem>
      </div>
    </>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '3px 0' }} />
}

function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '7px 14px',
        cursor: 'pointer',
        background: hover ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: danger ? '#ff6b6b' : '#fff',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </div>
  )
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
      <span style={{ width: 36, color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 5,
          color: '#fff',
          padding: '3px 6px',
          fontSize: 12,
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map((o) => (
          <option key={o} value={o} style={{ background: '#1a1a1a', color: '#fff' }}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{label}</span>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#7c6cf8', cursor: 'pointer' }}
      />
    </div>
  )
}
