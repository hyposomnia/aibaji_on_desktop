import { getConfig, LLMProfile } from './store'

export interface LLMCallbacks {
  onEmotion: (emotion: string) => void
  onText: (text: string) => void
}

const DEFAULT_SYSTEM_PROMPT_TEMPLATE =
  '你是{persona}。收到 Claude Code 的工作状态通知后，用角色口吻简短回应主人（不超过50字）。\n必须在回复开头选择一个表情，格式：[表情名]台词内容\n可用表情（只能选其中一个）：{emotions}\n示例：[微笑]主人又在努力工作了呢～'

/**
 * 构建系统提示词（支持自定义模板，占位符：{persona}、{emotions}）
 */
function buildSystemPrompt(persona: string, emotions: string[], template?: string): string {
  const emotionList = emotions.join('、')
  const tpl = (template && template.trim()) ? template : DEFAULT_SYSTEM_PROMPT_TEMPLATE
  return tpl.replace('{persona}', persona).replace('{emotions}', emotionList)
}

/**
 * 从插件已映射的 message 字段中提取消息。
 * 插件端负责全部语义映射，桌面端直接使用结果。
 */
function formatEventMessage(eventData: Record<string, unknown>): string {
  return (eventData.message as string) || `event: ${eventData.event || eventData.hook_event_name || 'unknown'}`
}

/**
 * 流式解析 LLM 响应，提取表情名和台词
 * 格式：[表情名]台词内容
 */
class StreamParser {
  private buffer = ''
  private emotionParsed = false
  private emotion = ''
  private textBuffer = ''
  private callbacks: LLMCallbacks

  constructor(callbacks: LLMCallbacks) {
    this.callbacks = callbacks
  }

  feed(chunk: string): void {
    this.buffer += chunk

    if (!this.emotionParsed) {
      // 寻找 [表情名] 格式
      const closeIdx = this.buffer.indexOf(']')
      if (closeIdx !== -1) {
        // 提取表情名（去掉开头的 [）
        const raw = this.buffer.slice(0, closeIdx)
        this.emotion = raw.startsWith('[') ? raw.slice(1) : raw
        this.emotionParsed = true
        // 触发表情回调（不等台词完成）
        if (this.emotion) {
          this.callbacks.onEmotion(this.emotion)
        }
        // 剩余内容是台词
        this.textBuffer = this.buffer.slice(closeIdx + 1)
      }
    } else {
      this.textBuffer += chunk
    }
  }

  finish(): void {
    const text = this.textBuffer.trim()
    if (text) {
      this.callbacks.onText(text)
    }
    // 如果没有解析到表情，用 fallback
    if (!this.emotionParsed) {
      this.callbacks.onEmotion('平静')
      this.callbacks.onText('')
    }
  }
}

/**
 * 解析角色应使用的 LLM Profile 和 persona
 */
export function resolveCharacterLLM(charName: string): { profile: LLMProfile | null; persona: string } {
  const config = getConfig()
  const charProfile = config.characterProfiles?.[charName]

  let profile: LLMProfile | null = null
  if (charProfile?.llmProfileId && config.llmProfiles?.length > 0) {
    profile = config.llmProfiles.find((p) => p.id === charProfile.llmProfileId) || null
  }
  if (!profile && config.llmProfiles?.length > 0) {
    profile = config.llmProfiles[0]
  }

  const persona = charProfile?.persona || config.llm.persona || '可爱的二次元角色'
  return { profile, persona }
}

/**
 * 使用 OpenAI 兼容 API 处理事件
 */
async function processWithOpenAI(
  message: string,
  systemPrompt: string,
  callbacks: LLMCallbacks,
  opts: { apiKey: string; baseURL: string; model: string }
): Promise<void> {
  const { default: OpenAI } = await import('openai')
  const { apiKey, baseURL, model } = opts

  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })

  const parser = new StreamParser(callbacks)

  const stream = await client.chat.completions.create({
    model: opts.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    max_tokens: 150,
    stream: true,
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) {
      parser.feed(delta)
    }
  }

  parser.finish()
}

/**
 * 使用 Anthropic API 处理事件
 */
async function processWithAnthropic(
  message: string,
  systemPrompt: string,
  callbacks: LLMCallbacks,
  opts: { apiKey: string; baseURL: string; model: string }
): Promise<void> {
  const Anthropic = await import('@anthropic-ai/sdk')
  const { apiKey, baseURL, model } = opts

  const client = new Anthropic.default({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })

  const parser = new StreamParser(callbacks)

  const stream = await client.messages.stream({
    model: opts.model,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
    max_tokens: 150,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      parser.feed(event.delta.text)
    }
  }

  parser.finish()
}

/**
 * 处理 Claude Code 事件并生成角色回应
 * 降级：LLM 未配置或出错时，使用平静 idle
 */
export async function processEvent(
  eventData: Record<string, unknown>,
  emotions: string[],
  callbacks: LLMCallbacks,
  llmProfile?: LLMProfile | null,
  persona?: string
): Promise<void> {
  const config = getConfig()

  // 决定使用哪套配置：优先 llmProfile，fallback 到 config.llm
  const apiMode = llmProfile?.apiMode ?? config.llm.apiMode
  const apiKey = llmProfile?.apiKey ?? config.llm.apiKey
  const baseURL = llmProfile?.baseURL ?? config.llm.baseURL
  const model = llmProfile?.model ?? config.llm.model
  const effectivePersona = persona ?? config.llm.persona ?? '可爱的伴侣'

  console.log(`[aibaji] processEvent: apiMode=${apiMode}, apiKey=${apiKey ? '***' : 'EMPTY'}, model=${model}, emotions=${emotions}`)

  // 降级：未配置 API Key
  if (!apiKey || emotions.length === 0) {
    console.log(`[aibaji] processEvent: fallback to idle (apiKey empty or no emotions)`)
    callbacks.onEmotion('平静')
    callbacks.onText('')
    return
  }

  const opts = { apiKey, baseURL, model }
  const message = formatEventMessage(eventData)
  // 不让 LLM 选平静——收到事件说明有交互，应有明显表情
  const emotionsForLLM = emotions.filter((e) => !e.startsWith('平静'))
  const systemPrompt = buildSystemPrompt(
    effectivePersona,
    emotionsForLLM.length > 0 ? emotionsForLLM : emotions,
    config.llm.systemPromptTemplate
  )
  try {
    if (apiMode === 'anthropic') {
      await processWithAnthropic(message, systemPrompt, callbacks, opts)
    } else {
      await processWithOpenAI(message, systemPrompt, callbacks, opts)
    }
  } catch (err) {
    console.error('[aibaji] LLM error:', err)
    callbacks.onEmotion('平静')
    callbacks.onText('')
  }
}

