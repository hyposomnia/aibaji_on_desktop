#!/usr/bin/env bash
# 从 git 一键安装爱巴基 OpenClaw Hook
#
# 用法（推荐）:
#   curl -fsSL https://raw.githubusercontent.com/hyposomnia/aibaji_on_desktop/main/plugin-openclaw/install.sh \
#     | bash -s -- <agentId> [port]
#
# 示例:
#   curl ... | bash -s -- main          # agent "main"，端口 5287
#   curl ... | bash -s -- work 5288     # agent "work"，端口 5288

set -euo pipefail

AGENT_ID="${1:?用法: install.sh <agentId> [port]}"
PORT="${2:-5287}"
WORKSPACE="${HOME}/.openclaw/workspace-${AGENT_ID}"
DEST="${WORKSPACE}/hooks/aibaji"

echo ">> 安装到 ${DEST}（端口 ${PORT}）..."
mkdir -p "${DEST}"

# ── HOOK.md ─────────────────────────────────────────────────────────────────
cat > "${DEST}/HOOK.md" << 'EOF'
---
name: aibaji
description: "Forward OpenClaw work status to Aibaji Desktop"
metadata:
  openclaw:
    emoji: "🎭"
    events:
      - command:new
      - command:stop
      - message:received
      - message:sent
      - tool_result_persist
    os: ["darwin", "linux"]
---
EOF

# ── handler.ts ───────────────────────────────────────────────────────────────
cat > "${DEST}/handler.ts" << 'EOF'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as http from 'http'
import * as https from 'https'

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
EOF

# ── config.json（含实际端口）─────────────────────────────────────────────────
cat > "${DEST}/config.json" << EOF
{
  "server_url": "http://localhost:${PORT}",
  "token": "",
  "messages": {
    "UserPromptSubmit": "Your instruction has been received.",
    "Stop": "Task complete",
    "PostToolUse": "{tool} finished"
  },
  "rateLimit": { "windowMs": 60000, "limit": 5 }
}
EOF

# ── 自动注册 hook ─────────────────────────────────────────────────────────────
if command -v openclaw &>/dev/null; then
  openclaw hooks install "${DEST}"
  echo ">> Hook 已注册"
else
  echo ">> openclaw 未找到，请手动运行："
  echo "   openclaw hooks install ${DEST}"
fi

echo ">> 完成！爱巴基将监听 http://localhost:${PORT}"
