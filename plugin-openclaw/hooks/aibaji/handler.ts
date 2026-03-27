import type { HookHandler } from 'openclaw/hooks'

const SERVER_URL = 'http://localhost:5287'
const WINDOW_MS = 60000
const WINDOW_LIMIT = 5

// Regular events share a rate-limit bucket; heartbeats bypass it (they are already time-spaced)
const timestamps: number[] = []

// Per-session heartbeat state
interface SessionEntry {
  startTime: number
  timers: ReturnType<typeof setTimeout>[]
}
const activeSessions = new Map<string, SessionEntry>()

// Heartbeat schedule: 10s, 1min, 5min, 10min, 30min, 1hr
const POLL_INTERVALS = [10_000, 60_000, 5 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000]

// ── helpers ──────────────────────────────────────────────────────────────────

/** Read the OpenClaw queue state from the same-process global singleton. */
function isSessionLaneActive(sessionKey: string): boolean | null {
  try {
    const qs = (globalThis as any)[Symbol.for('openclaw.commandQueueState')]
    if (!qs?.lanes) return null
    const laneKey = sessionKey.startsWith('session:') ? sessionKey : `session:${sessionKey}`
    const lane = qs.lanes.get(laneKey)
    if (!lane) return false
    return (lane.activeTaskIds?.size ?? 0) > 0 || (lane.queue?.length ?? 0) > 0
  } catch {
    return null // unknown
  }
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}h ${rm}m` : `${h}h`
}

function clearSession(sessionKey: string): void {
  const entry = activeSessions.get(sessionKey)
  if (!entry) return
  for (const t of entry.timers) clearTimeout(t)
  activeSessions.delete(sessionKey)
}

/** Rate-limited POST for regular events. */
function post(eventName: string, message: string): void {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift()
  if (timestamps.length >= WINDOW_LIMIT) return
  timestamps.push(now)
  sendEvent(eventName, message)
}

/** Unthrottled POST for heartbeats (inherently time-spaced). */
function postHeartbeat(eventName: string, message: string): void {
  sendEvent(eventName, message)
}

function sendEvent(eventName: string, message: string): void {
  fetch(`${SERVER_URL}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: eventName, message }),
  }).catch(() => {})
}

// ── heartbeat scheduler ───────────────────────────────────────────────────────

function scheduleHeartbeats(sessionKey: string, startTime: number): ReturnType<typeof setTimeout>[] {
  return POLL_INTERVALS.map((delay, i) =>
    setTimeout(() => {
      if (!activeSessions.has(sessionKey)) return

      const elapsed = formatElapsed(Date.now() - startTime)
      const isLast = i === POLL_INTERVALS.length - 1
      const active = isSessionLaneActive(sessionKey)

      if (active === false) {
        // Task finished but message:sent never fired — send fallback completion
        clearSession(sessionKey)
        postHeartbeat('message:sent', 'Task complete.')
        return
      }

      // Still running (or status unknown): report elapsed time
      const suffix = isLast ? ' (last check)' : ''
      postHeartbeat('heartbeat', `Still working… ${elapsed} elapsed.${suffix}`)

      // After the final heartbeat, clean up to avoid orphaned state
      if (isLast) clearSession(sessionKey)
    }, delay)
  )
}

// ── main handler ──────────────────────────────────────────────────────────────

const handler: HookHandler = async (event) => {
  const { type, action } = event as any
  const sessionKey: string = (event as any).sessionKey || 'default'

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

export default handler
