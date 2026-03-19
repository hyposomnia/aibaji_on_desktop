import { useState, useEffect } from 'react'

interface LLMProfile {
  id: string
  name: string
  apiMode: 'openai' | 'anthropic'
  apiKey: string
  baseURL: string
  model: string
}

interface TTSProfile {
  id: string
  name: string
  provider: 'minimax'
  apiKey: string
  model: string
  voiceId: string
}

interface CharacterProfile {
  persona: string
  llmProfileId: string
  ttsProfileId: string
}

function newLLMProfile(): LLMProfile {
  return {
    id: Date.now().toString(),
    name: '新模型',
    apiMode: 'openai',
    apiKey: '',
    baseURL: '',
    model: 'gpt-4o-mini',
  }
}

function newTTSProfile(): TTSProfile {
  return {
    id: Date.now().toString(),
    name: '新 TTS',
    provider: 'minimax',
    apiKey: '',
    model: 'speech-01',
    voiceId: '',
  }
}

export default function SettingsPage() {
  const [dataPath, setDataPath] = useState('')
  const [llmProfiles, setLlmProfiles] = useState<LLMProfile[]>([])
  const [ttsProfiles, setTtsProfiles] = useState<TTSProfile[]>([])
  const [characterProfiles, setCharacterProfiles] = useState<Record<string, CharacterProfile>>({})
  const [characters, setCharacters] = useState<string[]>([])
  const [outfitsMap, setOutfitsMap] = useState<Record<string, string[]>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    document.body.style.webkitAppRegion = 'no-drag'

    window.electronAPI.getConfig().then(async (cfg) => {
      const c = cfg as Record<string, unknown>
      const char = (c.character as Record<string, unknown>) || {}
      setDataPath((char.dataPath as string) || '')

      if (Array.isArray(c.llmProfiles)) setLlmProfiles(c.llmProfiles as LLMProfile[])
      if (Array.isArray(c.ttsProfiles)) setTtsProfiles(c.ttsProfiles as TTSProfile[])
      if (c.characterProfiles && typeof c.characterProfiles === 'object') {
        setCharacterProfiles(c.characterProfiles as Record<string, CharacterProfile>)
      }
    })

    window.electronAPI.getCharacters().then(async (chars) => {
      const charList = chars as string[]
      setCharacters(charList)
      const map: Record<string, string[]> = {}
      for (const char of charList) {
        const outfits = (await window.electronAPI.getOutfits(char)) as string[]
        map[char] = outfits
      }
      setOutfitsMap(map)
    })
  }, [])

  const handleSave = async () => {
    await window.electronAPI.setConfig({ llmProfiles, ttsProfiles, characterProfiles })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSelectFolder = async () => {
    const folder = (await window.electronAPI.selectFolder()) as string | null
    if (folder) {
      setDataPath(folder)
      const cfg = (await window.electronAPI.getConfig()) as Record<string, unknown>
      const char = (cfg.character as Record<string, unknown>) || {}
      await window.electronAPI.setConfig({ character: { ...char, dataPath: folder } })
    }
  }

  const updateLLMProfile = (id: string, patch: Partial<LLMProfile>) => {
    setLlmProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const updateTTSProfile = (id: string, patch: Partial<TTSProfile>) => {
    setTtsProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const updateCharProfile = (charName: string, patch: Partial<CharacterProfile>) => {
    setCharacterProfiles((prev) => ({
      ...prev,
      [charName]: { persona: '', llmProfileId: '', ttsProfileId: '', ...prev[charName], ...patch },
    }))
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>爱巴基设置</h2>

      {/* 区块一：角色资源文件夹 */}
      <Section title="角色资源文件夹">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            value={dataPath}
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
          例：<code style={styles.code}>流萤/制服/微笑.webm</code>
        </p>
      </Section>

      {/* 区块二：LLM 模型列表 */}
      <Section title="LLM 模型">
        {llmProfiles.map((p) => (
          <div key={p.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <input
                value={p.name}
                onChange={(e) => updateLLMProfile(p.id, { name: e.target.value })}
                placeholder="模型名称"
                style={{ ...styles.input, flex: 1 }}
              />
              <button
                onClick={() => setLlmProfiles((prev) => prev.filter((x) => x.id !== p.id))}
                style={styles.deleteButton}
              >
                删除
              </button>
            </div>
            <Field label="API 类型">
              <select
                value={p.apiMode}
                onChange={(e) => updateLLMProfile(p.id, { apiMode: e.target.value as 'openai' | 'anthropic' })}
                style={styles.select}
              >
                <option value="openai">OpenAI 兼容</option>
                <option value="anthropic">Anthropic 兼容</option>
              </select>
            </Field>
            <Field label="API Key">
              <input
                type="password"
                value={p.apiKey}
                onChange={(e) => updateLLMProfile(p.id, { apiKey: e.target.value })}
                placeholder="sk-..."
                style={styles.input}
              />
            </Field>
            <Field label="Base URL">
              <input
                value={p.baseURL}
                onChange={(e) => updateLLMProfile(p.id, { baseURL: e.target.value })}
                placeholder="留空使用官方地址"
                style={styles.input}
              />
            </Field>
            <Field label="模型">
              <input
                value={p.model}
                onChange={(e) => updateLLMProfile(p.id, { model: e.target.value })}
                placeholder="gpt-4o-mini"
                style={styles.input}
              />
            </Field>
          </div>
        ))}
        <button onClick={() => setLlmProfiles((prev) => [...prev, newLLMProfile()])} style={styles.addButton}>
          + 添加 LLM 模型
        </button>
      </Section>

      {/* 区块三：TTS 模型列表 */}
      <Section title="TTS 语音合成">
        {ttsProfiles.map((p) => (
          <div key={p.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <input
                value={p.name}
                onChange={(e) => updateTTSProfile(p.id, { name: e.target.value })}
                placeholder="TTS 名称"
                style={{ ...styles.input, flex: 1 }}
              />
              <button
                onClick={() => setTtsProfiles((prev) => prev.filter((x) => x.id !== p.id))}
                style={styles.deleteButton}
              >
                删除
              </button>
            </div>
            <Field label="供应商">
              <select value={p.provider} style={styles.select} disabled>
                <option value="minimax">MiniMax</option>
              </select>
            </Field>
            <Field label="API Key">
              <input
                type="password"
                value={p.apiKey}
                onChange={(e) => updateTTSProfile(p.id, { apiKey: e.target.value })}
                placeholder="MiniMax API Key"
                style={styles.input}
              />
            </Field>
            <Field label="模型">
              <input
                value={p.model}
                onChange={(e) => updateTTSProfile(p.id, { model: e.target.value })}
                placeholder="speech-01"
                style={styles.input}
              />
            </Field>
            <Field label="Voice ID">
              <input
                value={p.voiceId}
                onChange={(e) => updateTTSProfile(p.id, { voiceId: e.target.value })}
                placeholder="female-tianmei"
                style={styles.input}
              />
            </Field>
          </div>
        ))}
        <button onClick={() => setTtsProfiles((prev) => [...prev, newTTSProfile()])} style={styles.addButton}>
          + 添加 TTS 模型
        </button>
      </Section>

      {/* 区块四：角色列表 */}
      <Section title="角色配置">
        {characters.length === 0 && (
          <p style={styles.hint}>未扫描到角色，请先选择角色资源文件夹。</p>
        )}
        {characters.map((char) => {
          const cp = characterProfiles[char] || { persona: '', llmProfileId: '', ttsProfileId: '' }
          const outfits = outfitsMap[char] || []
          return (
            <div key={char} style={styles.card}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#1d1d1f' }}>
                {char}
              </div>
              {outfits.length > 0 && (
                <div style={styles.hint}>服装：{outfits.join('、')}</div>
              )}
              <Field label="人设">
                <textarea
                  value={cp.persona}
                  onChange={(e) => updateCharProfile(char, { persona: e.target.value })}
                  rows={4}
                  placeholder="可爱的二次元角色"
                  style={{ ...styles.input, resize: 'vertical' as const }}
                />
              </Field>
              <Field label="LLM 模型">
                <select
                  value={cp.llmProfileId}
                  onChange={(e) => updateCharProfile(char, { llmProfileId: e.target.value })}
                  style={styles.select}
                >
                  <option value="">默认（第一个）</option>
                  {llmProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="TTS 模型">
                <select
                  value={cp.ttsProfileId}
                  onChange={(e) => updateCharProfile(char, { ttsProfileId: e.target.value })}
                  style={styles.select}
                >
                  <option value="">默认（第一个）</option>
                  {ttsProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )
        })}
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
    height: '100%',
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
  card: {
    border: '1px solid #e5e5ea',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 10,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  field: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  label: {
    width: 72,
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
  addButton: {
    background: 'transparent',
    color: '#007aff',
    border: '1px dashed #007aff',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
    width: '100%',
    marginTop: 4,
  },
  deleteButton: {
    background: '#ff3b30',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    margin: '0 0 8px',
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
