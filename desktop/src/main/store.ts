import { ipcMain } from 'electron'

export interface LLMProfile {
  id: string
  name: string
  apiMode: 'openai' | 'anthropic'
  apiKey: string
  baseURL: string
  model: string
}

export interface TTSProfile {
  id: string
  name: string
  provider: 'minimax'
  apiKey: string
  model: string
  voiceId: string
}

export interface CharacterProfile {
  persona: string
  llmProfileId: string
  ttsProfileId: string
}

export interface AppConfig {
  server: {
    port: number
    token: string
    windowMs: number
    windowLimit: number
  }
  character: {
    name: string
    outfit: string
    dataPath: string
  }
  window: {
    scale: number
    opacity: number
    locked: boolean
    x: number
    y: number
    baseWidth: number
    baseHeight: number
  }
  llm: {
    apiMode: 'openai' | 'anthropic'
    apiKey: string
    baseURL: string
    model: string
    persona: string
    systemPromptTemplate: string
  }
  tts: {
    enabled: boolean
    provider: 'minimax'
    apiKey: string
    model: string
    voiceId: string
  }
  llmProfiles: LLMProfile[]
  ttsProfiles: TTSProfile[]
  characterProfiles: Record<string, CharacterProfile>
  autostart: boolean
  language: 'en' | 'zh-CN' | 'zh-TW' | 'ja'
}

const defaults: AppConfig = {
  server: {
    port: 5287,
    token: '',
    windowMs: 60000,
    windowLimit: 5,
  },
  character: {
    name: '',
    outfit: '',
    dataPath: '',
  },
  window: {
    scale: 1.0,
    opacity: 1.0,
    locked: false,
    x: 100,
    y: 100,
    baseWidth: 400,
    baseHeight: 400,
  },
  llm: {
    apiMode: 'openai',
    apiKey: '',
    baseURL: '',
    model: 'gpt-4o-mini',
    persona: '可爱的二次元角色',
    systemPromptTemplate: '你是一个Claude Code工作状态指示机器人，你的任务是根据输入的工作状态，拟人化的进行转述。\n输入的"我"指的是你，输入的"你"指的用户，要记住映射关系。\n你必须严格按照你的人设来将输入进行合理的转述，适当添加角色个性化内容。你的人格设定是：{persona}。\n必须在回复开头选择一个表情，格式：[表情名]台词内容\n可用表情（只能选其中一个）：{emotions}\n示例：[微笑]主人又在努力工作了呢～',
  },
  tts: {
    enabled: false,
    provider: 'minimax',
    apiKey: '',
    model: 'speech-01',
    voiceId: '',
  },
  llmProfiles: [],
  ttsProfiles: [],
  characterProfiles: {},
  autostart: true,
  language: 'zh-CN',
}

// electron-store v10 是 ESM only，需要动态导入
// 使用懒加载模式
type StoreType = {
  store: AppConfig
  get: (key: string) => unknown
  set: (key: string | Record<string, unknown>, value?: unknown) => void
  reset: (...keys: string[]) => void
}

let _store: StoreType | null = null

async function getStore(): Promise<StoreType> {
  if (_store) return _store
  const { default: Store } = await import('electron-store') as unknown as { default: new (opts: unknown) => StoreType }
  _store = new Store({
    defaults,
    schema: undefined, // 不使用 schema 验证，直接存储
  })
  return _store
}

// 同步获取配置（需先调用 initStore）
let _storeSync: StoreType | null = null

export async function initStore(): Promise<void> {
  _storeSync = await getStore()
}

export function getConfig(): AppConfig {
  if (!_storeSync) throw new Error('Store not initialized')
  return _storeSync.store as AppConfig
}

export function setConfig(partial: Partial<AppConfig>): void {
  if (!_storeSync) throw new Error('Store not initialized')
  for (const [key, value] of Object.entries(partial)) {
    _storeSync.set(key, value)
  }
}

export function resetConfig(): void {
  if (!_storeSync) throw new Error('Store not initialized')
  _storeSync.reset(...Object.keys(defaults))
}

export function registerHandlers(): void {
  ipcMain.handle('get-config', () => getConfig())
  ipcMain.handle('set-config', (_, partial: Partial<AppConfig>) => setConfig(partial))
  ipcMain.handle('reset-config', () => resetConfig())
}
