import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as http from 'http'
import * as https from 'https'

// 配置文件与 handler.ts 同目录
const CONFIG_PATH = join(__dirname, 'config.json')
const cfg = existsSync(CONFIG_PATH)
  ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
  : {}

const SERVER_URL: string = cfg.server_url ?? 'http://localhost:5287'
const TOKEN: string = cfg.token ?? ''
const WINDOW_MS: number = cfg.rateLimit?.windowMs ?? 60000
const WINDOW_LIMIT: number = cfg.rateLimit?.limit ?? 5

const DEFAULT_MESSAGES = {
  UserPromptSubmit: 'Your instruction has been received.',
  Stop: 'Task complete',
  PostToolUse: '{tool} finished',
}

const timestamps: number[] = []

const handler = async (event: any): Promise<void> => {
  const message = mapEvent(event, cfg.messages ?? DEFAULT_MESSAGES)
  if (!message) return

  const now = Date.now()
  const cutoff = now - WINDOW_MS
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift()
  if (timestamps.length >= WINDOW_LIMIT) return
  timestamps.push(now)

  sendAsync({ event: event.type, message }, SERVER_URL, TOKEN)
}

function mapEvent(event: any, tpl: Record<string, string>): string | null {
  const { type, action } = event
  if (type === 'command' && action === 'new')
    return tpl.UserPromptSubmit ?? DEFAULT_MESSAGES.UserPromptSubmit
  if (type === 'command' && action === 'stop')
    return tpl.Stop ?? DEFAULT_MESSAGES.Stop
  if (type === 'message' && action === 'received')
    return tpl.UserPromptSubmit ?? DEFAULT_MESSAGES.UserPromptSubmit
  if (type === 'message' && action === 'sent')
    return tpl.Stop ?? DEFAULT_MESSAGES.Stop
  if (type === 'tool_result_persist') {
    const tool: string = event.context?.toolName ?? ''
    return (tpl.PostToolUse ?? DEFAULT_MESSAGES.PostToolUse).replace('{tool}', tool)
  }
  return null
}

function sendAsync(body: object, serverUrl: string, token: string): void {
  const data = JSON.stringify(body)
  const url = new URL(`${serverUrl}/event`)
  const lib = url.protocol === 'https:' ? https : http
  const req = lib.request({
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  req.on('error', () => {})
  req.write(data)
  req.end()
}

export default handler
