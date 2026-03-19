import { useState, useEffect } from 'react'

interface LLMConfig {
  apiMode: 'openai' | 'anthropic'
  apiKey: string
  baseURL: string
  model: string
  persona: string
}

interface TTSConfig {
  enabled: boolean
  provider: string
  apiKey: string
  model: string
  voiceId: string
}

interface CharacterConfig {
  dataPath: string
  name: string
  outfit: string
}

export default function SettingsPage() {
  const [llm, setLlm] = useState<LLMConfig>({
    apiMode: 'openai',
    apiKey: '',
    baseURL: '',
    model: 'gpt-4o-mini',
    persona: '可爱的二次元角色',
  })
  const [tts, setTts] = useState<TTSConfig>({
    enabled: false,
    provider: 'minimax',
    apiKey: '',
    model: 'speech-01',
    voiceId: '',
  })
  const [character, setCharacter] = useState<CharacterConfig>({
    dataPath: '',
    name: '',
    outfit: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // 设置窗口不需要拖动区域
    document.body.style.webkitAppRegion = 'no-drag'
    window.electronAPI.getConfig().then((cfg) => {
      const c = cfg as Record<string, unknown>
      if (c.llm) setLlm(c.llm as LLMConfig)
      if (c.tts) setTts(c.tts as TTSConfig)
      if (c.character) setCharacter(c.character as CharacterConfig)
    })
  }, [])

  const handleSave = async () => {
    await window.electronAPI.setConfig({ llm, tts })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSelectFolder = async () => {
    const folder = (await window.electronAPI.selectFolder()) as string | null
    if (folder) {
      setCharacter((prev) => ({ ...prev, dataPath: folder }))
      await window.electronAPI.setConfig({ character: { ...character, dataPath: folder } })
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>爱巴基设置</h2>

      {/* 模型设置 */}
      <Section title="模型（LLM）">
        <Field label="API 类型">
          <select
            value={llm.apiMode}
            onChange={(e) => setLlm({ ...llm, apiMode: e.target.value as 'openai' | 'anthropic' })}
            style={styles.select}
          >
            <option value="openai">OpenAI 兼容（推荐）</option>
            <option value="anthropic">Anthropic 原生</option>
          </select>
        </Field>
        <Field label="API Key">
          <input
            type="password"
            value={llm.apiKey}
            onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
            placeholder="sk-..."
            style={styles.input}
          />
        </Field>
        <Field label="Base URL">
          <input
            value={llm.baseURL}
            onChange={(e) => setLlm({ ...llm, baseURL: e.target.value })}
            placeholder="留空使用官方默认地址"
            style={styles.input}
          />
        </Field>
        <Field label="模型">
          <input
            value={llm.model}
            onChange={(e) => setLlm({ ...llm, model: e.target.value })}
            placeholder="gpt-4o-mini"
            style={styles.input}
          />
        </Field>
        <Field label="角色人设">
          <textarea
            value={llm.persona}
            onChange={(e) => setLlm({ ...llm, persona: e.target.value })}
            rows={2}
            style={{ ...styles.input, resize: 'vertical' as const }}
          />
        </Field>
      </Section>

      {/* TTS 设置 */}
      <Section title="语音合成（TTS）">
        <Field label="启用 TTS">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tts.enabled}
              onChange={(e) => setTts({ ...tts, enabled: e.target.checked })}
            />
            <span style={{ fontSize: 13, color: '#666' }}>使用 MiniMax TTS 朗读角色台词</span>
          </label>
        </Field>
        {tts.enabled && (
          <>
            <Field label="API Key">
              <input
                type="password"
                value={tts.apiKey}
                onChange={(e) => setTts({ ...tts, apiKey: e.target.value })}
                placeholder="MiniMax API Key"
                style={styles.input}
              />
            </Field>
            <Field label="Voice ID">
              <input
                value={tts.voiceId}
                onChange={(e) => setTts({ ...tts, voiceId: e.target.value })}
                placeholder="female-tianmei"
                style={styles.input}
              />
            </Field>
          </>
        )}
      </Section>

      {/* 角色文件夹 */}
      <Section title="角色资源文件夹">
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input
              value={character.dataPath}
              readOnly
              placeholder="未选择文件夹"
              style={{ ...styles.input, flex: 1, color: '#888' }}
            />
            <button onClick={handleSelectFolder} style={styles.secondaryButton}>
              更换…
            </button>
          </div>
          <p style={styles.hint}>
            文件夹格式：<code style={styles.code}>{`{角色名}/{服装名}/{表情名}[数字].webm`}</code>
            <br />
            例：<code style={styles.code}>流萤/制服/微笑.webm</code>、
            <code style={styles.code}>流萤/制服/平静1.1.webm</code>
            <br />
            添加角色：在文件夹中新建对应目录结构即可。删除角色：删除对应目录。
          </p>
        </div>
      </Section>

      {/* 保存按钮 */}
      <div style={{ padding: '0 20px 20px', textAlign: 'right' as const }}>
        <button onClick={handleSave} style={styles.saveButton}>
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    background: '#f5f5f7',
    minHeight: '100vh',
    overflowY: 'auto',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 600,
    padding: '20px 20px 10px',
    margin: 0,
    color: '#1d1d1f',
    borderBottom: '1px solid #e0e0e0',
    background: '#fff',
  },
  section: {
    background: '#fff',
    margin: '12px 16px',
    borderRadius: 10,
    padding: '12px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#6e6e73',
    margin: '0 0 10px',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  field: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  label: {
    width: 80,
    fontSize: 13,
    color: '#3a3a3c',
    paddingTop: 6,
    flexShrink: 0,
  },
  input: {
    width: '100%',
    padding: '5px 8px',
    border: '1px solid #d1d1d6',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    padding: '5px 8px',
    border: '1px solid #d1d1d6',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    background: '#fff',
  },
  saveButton: {
    background: '#007aff',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 24px',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 500,
  },
  secondaryButton: {
    background: '#f0f0f5',
    color: '#333',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    margin: 0,
    lineHeight: 1.6,
  },
  code: {
    background: '#f0f0f5',
    borderRadius: 3,
    padding: '1px 4px',
    fontFamily: 'monospace',
    fontSize: 11,
  },
}
