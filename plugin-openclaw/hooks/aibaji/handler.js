const SERVER_URL = 'http://localhost:5287'
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

  const eventName = event.action ? `${event.type}:${event.action}` : event.type
  fetch(`${SERVER_URL}/event`, {
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
    return tool ? `${tool} finished` : 'Tool finished'
  }
  return null
}

module.exports = handler
module.exports.default = handler
