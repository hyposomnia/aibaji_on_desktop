import { useState, useEffect } from 'react'
import { t, LANG_LABELS, type Lang } from './i18n'

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

const DEFAULT_TEMPLATE =
  '你是{persona}。收到 Claude Code 的工作状态通知后，用角色口吻简短回应主人（不超过50字）。\n必须在回复开头选择一个表情，格式：[表情名]台词内容\n可用表情（只能选其中一个）：{emotions}\n示例：[微笑]主人又在努力工作了呢～'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'character' | 'system'>('character')
  const [lang, setLang] = useState<Lang>('zh-CN')

  // 角色配置 tab 状态
  const [dataPath, setDataPath] = useState('')
  const [llmProfiles, setLlmProfiles] = useState<LLMProfile[]>([])
  const [ttsProfiles, setTtsProfiles] = useState<TTSProfile[]>([])
  const [characterProfiles, setCharacterProfiles] = useState<Record<string, CharacterProfile>>({})
  const [characters, setCharacters] = useState<string[]>([])
  const [outfitsMap, setOutfitsMap] = useState<Record<string, string[]>>({})

  // 系统设置 tab 状态
  const [windowMs, setWindowMs] = useState(60000)
  const [windowLimit, setWindowLimit] = useState(5)
  const [systemPromptTemplate, setSystemPromptTemplate] = useState(DEFAULT_TEMPLATE)
  const [autostart, setAutostart] = useState(true)

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    document.body.style.webkitAppRegion = 'no-drag'

    window.electronAPI.getConfig().then(async (cfg) => {
      const c = cfg as Record<string, unknown>

      const char = (c.character as Record<string, unknown>) || {}
      setDataPath((char.dataPath as string) || '')

      const srv = (c.server as Record<string, unknown>) || {}
      setWindowMs(typeof srv.windowMs === 'number' ? srv.windowMs : 60000)
      setWindowLimit(typeof srv.windowLimit === 'number' ? srv.windowLimit : 5)

      const llm = (c.llm as Record<string, unknown>) || {}
      setSystemPromptTemplate((llm.systemPromptTemplate as string) || DEFAULT_TEMPLATE)

      if (Array.isArray(c.llmProfiles)) setLlmProfiles(c.llmProfiles as LLMProfile[])
      if (Array.isArray(c.ttsProfiles)) setTtsProfiles(c.ttsProfiles as TTSProfile[])
      if (c.characterProfiles && typeof c.characterProfiles === 'object') {
        setCharacterProfiles(c.characterProfiles as Record<string, CharacterProfile>)
      }
      if (c.language) setLang(c.language as Lang)
    })

    window.electronAPI.getAutostart().then((val) => setAutostart(val))

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
    const cfg = (await window.electronAPI.getConfig()) as Record<string, unknown>
    const srv = (cfg.server as Record<string, unknown>) || {}
    const llm = (cfg.llm as Record<string, unknown>) || {}
    await window.electronAPI.setConfig({
      server: { ...srv, windowMs, windowLimit },
      llm: { ...llm, systemPromptTemplate },
      llmProfiles,
      ttsProfiles,
      characterProfiles,
    })
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

  const handleLangChange = async (newLang: Lang) => {
    setLang(newLang)
    await window.electronAPI.setConfig({ language: newLang })
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

  const newLLMProfile = (): LLMProfile => ({
    id: Date.now().toString(),
    name: t(lang, 'newModelName'),
    apiMode: 'openai',
    apiKey: '',
    baseURL: '',
    model: 'gpt-4o-mini',
  })

  const newTTSProfile = (): TTSProfile => ({
    id: Date.now().toString(),
    name: t(lang, 'newTTSName'),
    provider: 'minimax',
    apiKey: '',
    model: 'speech-01',
    voiceId: '',
  })

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>{t(lang, 'settingsTitle')}</h2>

      {/* Tab 栏 */}
      <div style={styles.tabBar}>
        <button
          onClick={() => setActiveTab('character')}
          style={activeTab === 'character' ? styles.tabActive : styles.tab}
        >
          {t(lang, 'tabCharacter')}
        </button>
        <button
          onClick={() => setActiveTab('system')}
          style={activeTab === 'system' ? styles.tabActive : styles.tab}
        >
          {t(lang, 'tabSystem')}
        </button>
      </div>

      {/* 角色配置 tab */}
      {activeTab === 'character' && (
        <>
          <Section title={t(lang, 'sectionCharacterFolder')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                value={dataPath}
                readOnly
                placeholder={t(lang, 'folderNotSelected')}
                style={{ ...styles.input, flex: 1, color: '#888' }}
              />
              <button onClick={handleSelectFolder} style={styles.secondaryButton}>
                {t(lang, 'folderChange')}
              </button>
            </div>
            <p style={styles.hint}>
              {t(lang, 'folderHint')}
              <br />
              <code style={styles.code}>{t(lang, 'folderExample')}</code>
            </p>
          </Section>

          <Section title={t(lang, 'sectionCharacterConfig')}>
            {characters.length === 0 && (
              <p style={styles.hint}>{t(lang, 'noCharacters')}</p>
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
                    <div style={styles.hint}>{t(lang, 'outfits')}：{outfits.join('、')}</div>
                  )}
                  <Field label={t(lang, 'fieldPersona')}>
                    <textarea
                      value={cp.persona}
                      onChange={(e) => updateCharProfile(char, { persona: e.target.value })}
                      rows={4}
                      placeholder={t(lang, 'personaPlaceholder')}
                      style={{ ...styles.input, resize: 'vertical' as const }}
                    />
                  </Field>
                  <Field label={t(lang, 'fieldLLMModel')}>
                    <select
                      value={cp.llmProfileId}
                      onChange={(e) => updateCharProfile(char, { llmProfileId: e.target.value })}
                      style={styles.select}
                    >
                      <option value="">{t(lang, 'defaultFirst')}</option>
                      {llmProfiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t(lang, 'fieldTTSModel')}>
                    <select
                      value={cp.ttsProfileId}
                      onChange={(e) => updateCharProfile(char, { ttsProfileId: e.target.value })}
                      style={styles.select}
                    >
                      <option value="">{t(lang, 'defaultFirst')}</option>
                      {ttsProfiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              )
            })}
          </Section>
        </>
      )}

      {/* 系统设置 tab */}
      {activeTab === 'system' && (
        <>
          <Section title={t(lang, 'sectionStartup')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, color: '#1d1d1f' }}>{t(lang, 'autostartLabel')}</div>
                <div style={styles.hint}>{t(lang, 'autostartHint')}</div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={autostart}
                  onChange={async (e) => {
                    const val = e.target.checked
                    setAutostart(val)
                    await window.electronAPI.setAutostart(val)
                  }}
                  style={{ display: 'none' }}
                />
                <span style={{ ...styles.toggleTrack, background: autostart ? '#007aff' : '#d1d1d6' }}>
                  <span style={{ ...styles.toggleThumb, transform: autostart ? 'translateX(20px)' : 'translateX(2px)' }} />
                </span>
              </label>
            </div>
          </Section>

          <Section title={t(lang, 'sectionLanguage')}>
            <select
              value={lang}
              onChange={(e) => handleLangChange(e.target.value as Lang)}
              style={{ ...styles.select, width: 'auto', minWidth: 160 }}
            >
              {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </Section>

          <Section title={t(lang, 'sectionLLM')}>
            {llmProfiles.map((p) => (
              <div key={p.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <input
                    value={p.name}
                    onChange={(e) => updateLLMProfile(p.id, { name: e.target.value })}
                    placeholder={t(lang, 'modelNamePlaceholder')}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <button
                    onClick={() => setLlmProfiles((prev) => prev.filter((x) => x.id !== p.id))}
                    style={styles.deleteButton}
                  >
                    {t(lang, 'btnDelete')}
                  </button>
                </div>
                <Field label={t(lang, 'fieldAPIType')}>
                  <select
                    value={p.apiMode}
                    onChange={(e) =>
                      updateLLMProfile(p.id, { apiMode: e.target.value as 'openai' | 'anthropic' })
                    }
                    style={styles.select}
                  >
                    <option value="openai">{t(lang, 'apiOpenAI')}</option>
                    <option value="anthropic">{t(lang, 'apiAnthropic')}</option>
                  </select>
                </Field>
                <Field label={t(lang, 'fieldAPIKey')}>
                  <input
                    type="password"
                    value={p.apiKey}
                    onChange={(e) => updateLLMProfile(p.id, { apiKey: e.target.value })}
                    placeholder="sk-..."
                    style={styles.input}
                  />
                </Field>
                <Field label={t(lang, 'fieldBaseURL')}>
                  <input
                    value={p.baseURL}
                    onChange={(e) => updateLLMProfile(p.id, { baseURL: e.target.value })}
                    placeholder={t(lang, 'baseURLPlaceholder')}
                    style={styles.input}
                  />
                </Field>
                <Field label={t(lang, 'fieldModel')}>
                  <input
                    value={p.model}
                    onChange={(e) => updateLLMProfile(p.id, { model: e.target.value })}
                    placeholder="gpt-4o-mini"
                    style={styles.input}
                  />
                </Field>
              </div>
            ))}
            <button
              onClick={() => setLlmProfiles((prev) => [...prev, newLLMProfile()])}
              style={styles.addButton}
            >
              {t(lang, 'btnAddLLM')}
            </button>
          </Section>

          <Section title={t(lang, 'sectionTTS')}>
            {ttsProfiles.map((p) => (
              <div key={p.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <input
                    value={p.name}
                    onChange={(e) => updateTTSProfile(p.id, { name: e.target.value })}
                    placeholder={t(lang, 'ttsNamePlaceholder')}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <button
                    onClick={() => setTtsProfiles((prev) => prev.filter((x) => x.id !== p.id))}
                    style={styles.deleteButton}
                  >
                    {t(lang, 'btnDelete')}
                  </button>
                </div>
                <Field label={t(lang, 'fieldProvider')}>
                  <select value={p.provider} style={styles.select} disabled>
                    <option value="minimax">MiniMax</option>
                  </select>
                </Field>
                <Field label={t(lang, 'fieldAPIKey')}>
                  <input
                    type="password"
                    value={p.apiKey}
                    onChange={(e) => updateTTSProfile(p.id, { apiKey: e.target.value })}
                    placeholder="MiniMax API Key"
                    style={styles.input}
                  />
                </Field>
                <Field label={t(lang, 'fieldModel')}>
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
            <button
              onClick={() => setTtsProfiles((prev) => [...prev, newTTSProfile()])}
              style={styles.addButton}
            >
              {t(lang, 'btnAddTTS')}
            </button>
          </Section>

          <Section title={t(lang, 'sectionThrottle')}>
            <Field label={t(lang, 'fieldTimeWindow')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={10000}
                  max={300000}
                  step={5000}
                  value={windowMs}
                  onChange={(e) => setWindowMs(Number(e.target.value))}
                  style={{ ...styles.input, width: 90 }}
                />
                <span style={{ fontSize: 13, color: '#888' }}>{t(lang, 'unitMs')}</span>
              </div>
            </Field>
            <Field label={t(lang, 'fieldMaxEvents')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={windowLimit}
                  onChange={(e) => setWindowLimit(Number(e.target.value))}
                  style={{ ...styles.input, width: 60 }}
                />
                <span style={{ fontSize: 13, color: '#888' }}>{t(lang, 'unitEvents')}</span>
              </div>
            </Field>
            <p style={styles.hint}>{t(lang, 'throttleHint')}</p>
          </Section>

          <Section title={t(lang, 'sectionSystemPrompt')}>
            <p style={styles.hint}>
              {t(lang, 'systemPromptHint')}
            </p>
            <textarea
              value={systemPromptTemplate}
              onChange={(e) => setSystemPromptTemplate(e.target.value)}
              rows={8}
              style={{ ...styles.input, resize: 'vertical' as const, fontFamily: 'monospace', fontSize: 12 }}
            />
            <button
              onClick={() => setSystemPromptTemplate(DEFAULT_TEMPLATE)}
              style={{ ...styles.secondaryButton, marginTop: 6 }}
            >
              {t(lang, 'btnResetDefault')}
            </button>
          </Section>
        </>
      )}

      {/* 保存按钮 */}
      <div style={{ padding: '0 20px 20px', textAlign: 'right' as const }}>
        <button onClick={handleSave} style={styles.saveButton}>
          {saved ? t(lang, 'btnSaved') : t(lang, 'btnSave')}
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
  tabBar: {
    display: 'flex',
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
    padding: '0 16px',
    gap: 4,
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '10px 14px',
    fontSize: 14,
    color: '#666',
    cursor: 'pointer',
    marginBottom: -1,
  },
  tabActive: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #007aff',
    padding: '10px 14px',
    fontSize: 14,
    color: '#007aff',
    cursor: 'pointer',
    fontWeight: 500,
    marginBottom: -1,
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
  toggle: {
    cursor: 'pointer',
    flexShrink: 0,
  },
  toggleTrack: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 44,
    height: 26,
    borderRadius: 13,
    transition: 'background 0.2s',
    position: 'relative' as const,
  },
  toggleThumb: {
    position: 'absolute' as const,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    transition: 'transform 0.2s',
  },
  code: {
    background: '#f0f0f5',
    borderRadius: 3,
    padding: '1px 4px',
    fontFamily: 'monospace',
    fontSize: 11,
  },
}
