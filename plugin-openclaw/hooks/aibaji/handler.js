const SERVER_URL = 'http://localhost:5287'
const WINDOW_MS = 60000
const WINDOW_LIMIT = 5

const timestamps = []
const activeSessions = new Map()
const POLL_INTERVALS = [10_000, 60_000, 5 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000]

function isSessionLaneActive(sessionKey) {
  try {
    const qs = globalThis[Symbol.for('openclaw.commandQueueState')]
    if (!qs?.lanes) return null
    const laneKey = sessionKey.startsWith('session:') ? sessionKey : `session:${sessionKey}`
    const lane = qs.lanes.get(laneKey)
    if (!lane) return false
    return (lane.activeTaskIds?.size ?? 0) > 0 || (lane.queue?.length ?? 0) > 0
  } catch {
    return null
  }
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}h ${rm}m` : `${h}h`
}

function clearSession(sessionKey) {
  const entry = activeSessions.get(sessionKey)
  if (!entry) return
  for (const t of entry.timers) clearTimeout(t)
  activeSessions.delete(sessionKey)
}

function sendEvent(eventName, message) {
  fetch(`${SERVER_URL}/event`, {
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
      postHeartbeat('heartbeat', `Still working… ${elapsed} elapsed.${suffix}`)

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
    post(`command:${action}`, 'Starting a new session.')
    return
  }
}

module.exports = handler
module.exports.default = handler
