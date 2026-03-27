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
metadata: {"openclaw":{"emoji":"🎭","events":["message:received","message:sent","agent:bootstrap","command:new","command:reset"]}}
---
EOF

# ── handler.js（CJS，端口在安装时内联）──────────────────────────────────────
cat > "${DEST}/handler.js" << EOF
const SERVER_URL = 'http://localhost:${PORT}'
const WINDOW_MS = 60000
const WINDOW_LIMIT = 5

const timestamps = []
const activeSessions = new Map()
const POLL_INTERVALS = [10_000, 60_000, 5 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000]

function isSessionLaneActive(sessionKey) {
  try {
    const qs = globalThis[Symbol.for('openclaw.commandQueueState')]
    if (!qs?.lanes) return null
    const laneKey = sessionKey.startsWith('session:') ? sessionKey : \`session:\${sessionKey}\`
    const lane = qs.lanes.get(laneKey)
    if (!lane) return false
    return (lane.activeTaskIds?.size ?? 0) > 0 || (lane.queue?.length ?? 0) > 0
  } catch {
    return null
  }
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return \`\${s}s\`
  const m = Math.floor(s / 60)
  if (m < 60) return \`\${m}m\`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? \`\${h}h \${rm}m\` : \`\${h}h\`
}

function clearSession(sessionKey) {
  const entry = activeSessions.get(sessionKey)
  if (!entry) return
  for (const t of entry.timers) clearTimeout(t)
  activeSessions.delete(sessionKey)
}

function sendEvent(eventName, message) {
  fetch(\`\${SERVER_URL}/event\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: eventName, message }),
  }).catch(() => {})
}

function post(eventName, message) {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift()
  if (timestamps.length >= WINDOW_LIMIT) return
  timestamps.push(now)
  sendEvent(eventName, message)
}

function postHeartbeat(eventName, message) {
  sendEvent(eventName, message)
}

function scheduleHeartbeats(sessionKey, startTime) {
  return POLL_INTERVALS.map((delay, i) =>
    setTimeout(() => {
      if (!activeSessions.has(sessionKey)) return

      const elapsed = formatElapsed(Date.now() - startTime)
      const isLast = i === POLL_INTERVALS.length - 1
      const active = isSessionLaneActive(sessionKey)

      if (active === false) {
        clearSession(sessionKey)
        postHeartbeat('message:sent', 'Task complete.')
        return
      }

      const suffix = isLast ? ' (last check)' : ''
      postHeartbeat('heartbeat', \`Still working… \${elapsed} elapsed.\${suffix}\`)

      if (isLast) clearSession(sessionKey)
    }, delay)
  )
}

const handler = async (event) => {
  const { type, action } = event
  const sessionKey = event.sessionKey || 'default'

  if (type === 'message' && action === 'received') {
    clearSession(sessionKey)
    const startTime = Date.now()
    const timers = scheduleHeartbeats(sessionKey, startTime)
    activeSessions.set(sessionKey, { startTime, timers })
    post('message:received', 'Your instruction has been received.')
    return
  }

  if (type === 'message' && action === 'sent') {
    clearSession(sessionKey)
    post('message:sent', 'Task complete.')
    return
  }

  if (type === 'agent' && action === 'bootstrap') {
    post('agent:bootstrap', "I'm ready.")
    return
  }

  if (type === 'command' && (action === 'new' || action === 'reset')) {
    clearSession(sessionKey)
    post(\`command:\${action}\`, 'Starting a new session.')
    return
  }
}

module.exports = handler
module.exports.default = handler
EOF

# ── config.json（含实际端口）─────────────────────────────────────────────────
cat > "${DEST}/config.json" << EOF
{
  "server_url": "http://localhost:${PORT}",
  "token": "",
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
