import express, { Request, Response } from 'express'
import { EventEmitter } from 'events'
import type { Server } from 'http'
import { getConfig } from './store'

const emitter = new EventEmitter()
let httpServer: Server | null = null

// 事件节流：记录每种事件类型的最近处理时间
const lastProcessed = new Map<string, number>()
const THROTTLE_MS = 3000 // 3 秒内同类事件只处理一次

/**
 * 启动 HTTP 服务
 */
export async function startServer(): Promise<void> {
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  // POST /event - 接收 Claude Code hook 事件
  app.post('/event', (req: Request, res: Response) => {
    const config = getConfig()

    // 可选 Bearer Token 鉴权
    if (config.server.token) {
      const authHeader = req.headers.authorization
      const expectedToken = `Bearer ${config.server.token}`
      if (authHeader !== expectedToken) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
    }

    // 立即返回 200
    res.json({ status: 'ok' })

    // 异步处理（节流）
    const body = req.body as Record<string, unknown>
    const eventType = (body.hook_event_name as string) || 'unknown'
    const now = Date.now()
    const last = lastProcessed.get(eventType) || 0

    if (now - last >= THROTTLE_MS) {
      lastProcessed.set(eventType, now)
      // 异步 emit，不阻塞响应
      setImmediate(() => {
        emitter.emit('event', body)
      })
    }
  })

  // GET /health - 健康检查
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: '0.1.0' })
  })

  return new Promise((resolve, reject) => {
    const port = getConfig().server.port
    httpServer = app.listen(port, '127.0.0.1', () => {
      console.log(`[aibaji] HTTP server listening on http://127.0.0.1:${port}`)
      resolve()
    })
    httpServer!.on('error', reject)
  })
}

/**
 * 注册事件监听器
 */
export function onEvent(callback: (data: Record<string, unknown>) => void): void {
  emitter.on('event', callback)
}

/**
 * 停止 HTTP 服务
 */
export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!httpServer) {
      resolve()
      return
    }
    httpServer.close(() => {
      httpServer = null
      resolve()
    })
  })
}
