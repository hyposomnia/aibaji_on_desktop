import { getConfig } from './store'

export interface LLMCallbacks {
  onEmotion: (emotion: string) => void
  onText: (text: string) => void
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(persona: string, emotions: string[]): string {
  const emotionList = emotions.join('、')
  return `你是${persona}。收到 Claude Code 的工作状态通知后，用角色口吻简短回应主人（不超过50字）。
必须在回复开头选择一个表情，格式：[表情名]台词内容
可用表情（只能选其中一个）：${emotionList}
示例：[微笑]主人又在努力工作了呢～`
}

/**
 * 格式化事件数据为用户消息
 */
function formatEventMessage(eventData: Record<string, unknown>): string {
  const eventName = (eventData.hook_event_name as string) || 'unknown'
  const toolName = (eventData.tool_name as string) || ''

  const eventDescriptions: Record<string, string> = {
    PreToolUse: toolName ? `正在使用工具：${toolName}` : '即将执行操作',
    PostToolUse: toolName ? `完成工具使用：${toolName}` : '操作已完成',
    Stop: '回答已完成，等待下一个指令',
    Notification: (eventData.message as string) || '有新通知',
    UserPromptSubmit: '收到主人的新指令',
  }

  return eventDescriptions[eventName] || `事件：${eventName}`
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
 * 使用 OpenAI 兼容 API 处理事件
 */
async function processWithOpenAI(
  message: string,
  systemPrompt: string,
  callbacks: LLMCallbacks
): Promise<void> {
  const { default: OpenAI } = await import('openai')
  const config = getConfig()
  const { apiKey, baseURL, model } = config.llm

  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })

  const parser = new StreamParser(callbacks)

  const stream = await client.chat.completions.create({
    model,
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
  callbacks: LLMCallbacks
): Promise<void> {
  const Anthropic = await import('@anthropic-ai/sdk')
  const config = getConfig()
  const { apiKey, baseURL, model } = config.llm

  const client = new Anthropic.default({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })

  const parser = new StreamParser(callbacks)

  const stream = await client.messages.stream({
    model,
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
  callbacks: LLMCallbacks
): Promise<void> {
  const config = getConfig()
  const { apiMode, apiKey, persona } = config.llm

  // 降级：未配置 API Key
  if (!apiKey || emotions.length === 0) {
    callbacks.onEmotion('平静')
    callbacks.onText('')
    return
  }

  const message = formatEventMessage(eventData)
  const systemPrompt = buildSystemPrompt(persona || '可爱的伴侣', emotions)

  try {
    if (apiMode === 'anthropic') {
      await processWithAnthropic(message, systemPrompt, callbacks)
    } else {
      await processWithOpenAI(message, systemPrompt, callbacks)
    }
  } catch (err) {
    console.error('[aibaji] LLM error:', err)
    // 降级：出错时使用平静 idle
    callbacks.onEmotion('平静')
    callbacks.onText('')
  }
}
