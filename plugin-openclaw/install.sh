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
metadata: {"openclaw":{"emoji":"🎭","events":["command:new","command:stop","message:received","message:sent","tool_result_persist"]}}
---
EOF

# ── handler.js（CJS，端口在安装时内联）──────────────────────────────────────
cat > "${DEST}/handler.js" << EOF
const SERVER_URL = 'http://localhost:${PORT}'
const WINDOW_MS = 60000
const WINDOW_LIMIT = 5
const timestamps = []

const handler = async (event) => {
  const message = mapEvent(event)
  if (!message) return

  const now = Date.now()
  const cutoff = now - WINDOW_MS
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift()
  if (timestamps.length >= WINDOW_LIMIT) return
  timestamps.push(now)

  const eventName = event.action ? \`\${event.type}:\${event.action}\` : event.type
  fetch(\`\${SERVER_URL}/event\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: eventName, message }),
  }).catch(() => {})
}

function mapEvent(event) {
  const { type, action } = event
  if (type === 'command' && action === 'new') return 'Your instruction has been received.'
  if (type === 'command' && action === 'stop') return 'Task complete'
  if (type === 'message' && action === 'received') return 'Your instruction has been received.'
  if (type === 'message' && action === 'sent') return 'Task complete'
  if (type === 'tool_result_persist') {
    const tool = (event.context && event.context.toolName) || ''
    return tool ? \`\${tool} finished\` : 'Tool finished'
  }
  return null
}

module.exports = handler
module.exports.default = handler
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
