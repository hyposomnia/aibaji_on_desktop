#!/usr/bin/env bash
# 一键安装爱巴基 OpenClaw Hook（全局，适用所有 agent）
#
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/hyposomnia/aibaji_on_desktop/main/plugin-openclaw/install.sh | bash
#   curl -fsSL ... | bash -s -- 5288   # 自定义端口

set -euo pipefail

PORT="${1:-5287}"
DEST="$HOME/.openclaw/hooks/aibaji"

echo ">> 安装爱巴基 OpenClaw Hook（端口 ${PORT}）..."
mkdir -p "${DEST}"

# ── HOOK.md ──────────────────────────────────────────────────────────────────
cat > "${DEST}/HOOK.md" << 'EOF'
---
name: aibaji
description: "Forward OpenClaw work status to Aibaji Desktop"
metadata: {"openclaw":{"emoji":"🎭","events":["message:received","message:sent","agent:bootstrap","command:new","command:reset"]}}
---
EOF

# ── handler.js（CJS，端口在安装时内联）───────────────────────────────────────
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

function scheduleHeartbeats(sessionKey, startTime) {
  return POLL_INTERVALS.map((delay, i) =>
    setTimeout(() => {
      if (!activeSessions.has(sessionKey)) return
      const elapsed = formatElapsed(Date.now() - startTime)
      const isLast = i === POLL_INTERVALS.length - 1
      const active = isSessionLaneActive(sessionKey)
      if (active === false) {
        clearSession(sessionKey)
        sendEvent('message:sent', 'Task complete.')
        return
      }
      sendEvent('heartbeat', \`Still working… \${elapsed} elapsed.\${isLast ? ' (last check)' : ''}\`)
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
    activeSessions.set(sessionKey, { startTime, timers: scheduleHeartbeats(sessionKey, startTime) })
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

# ── 重载 gateway ──────────────────────────────────────────────────────────────
if pkill -USR1 -f openclaw-hooks 2>/dev/null; then
  echo ">> Gateway 已重载"
else
  echo ">> 未检测到运行中的 gateway，请手动重启 OpenClaw"
fi

# ── 验证 ──────────────────────────────────────────────────────────────────────
sleep 1
if command -v openclaw &>/dev/null && openclaw hooks list 2>/dev/null | grep -q aibaji; then
  echo ">> 安装完成！向 agent 发一条消息，爱巴基即会响应。"
else
  echo ">> 文件已写入 ${DEST}，gateway 重启后自动生效。"
fi
