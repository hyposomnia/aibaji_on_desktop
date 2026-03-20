import { useState, useEffect } from 'react'
import VideoPlayer from './VideoPlayer'
import SettingsPage from './SettingsPage'
import { t, type Lang } from './i18n'

export default function App() {
  const [showSetup, setShowSetup] = useState(false)
  const [lang, setLang] = useState<Lang>('zh-CN')

  useEffect(() => {
    window.electronAPI?.onNeedSetup(() => setShowSetup(true))
    window.electronAPI?.getConfig().then((cfg: { language?: Lang }) => {
      if (cfg.language) setLang(cfg.language)
    })
  }, [])

  if (window.location.hash === '#settings') {
    return <SettingsPage />
  }

  return (
    <>
      <VideoPlayer />
      {showSetup && <SetupModal lang={lang} onComplete={() => setShowSetup(false)} />}
    </>
  )
}

function SetupModal({ lang, onComplete }: { lang: Lang; onComplete: () => void }) {
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState('')

  const handleSelect = async () => {
    setSelecting(true)
    setError('')
    try {
      const folder = await window.electronAPI.selectFolder() as string | null
      if (!folder) {
        setSelecting(false)
        return
      }
      await window.electronAPI.setConfig({
        character: { dataPath: folder, name: '', outfit: '' },
      })
      window.electronAPI.sendSetupComplete()
      onComplete()
    } catch (e) {
      setError(t(lang, 'setupError'))
      setSelecting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)',
        zIndex: 9999,
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <div
        style={{
          background: '#1a1a2e',
          border: '1px solid #333',
          borderRadius: 14,
          padding: '32px 28px',
          width: 280,
          textAlign: 'center',
          color: '#fff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 14, lineHeight: 1 }}>🎭</div>
        <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 600 }}>
          {t(lang, 'setupTitle')}
        </h2>
        <p style={{ margin: '0 0 24px', color: '#999', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
          {t(lang, 'setupDesc')}
        </p>
        {error && (
          <p style={{ margin: '0 0 12px', color: '#ff6b6b', fontSize: 12 }}>{error}</p>
        )}
        <button
          onClick={handleSelect}
          disabled={selecting}
          style={{
            background: selecting ? '#555' : '#6c63ff',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '11px 0',
            fontSize: 14,
            cursor: selecting ? 'default' : 'pointer',
            width: '100%',
            transition: 'background 0.2s',
          }}
        >
          {selecting ? t(lang, 'setupSelecting') : t(lang, 'setupSelect')}
        </button>
      </div>
    </div>
  )
}
