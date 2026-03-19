import * as https from 'https'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawn, type ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'
import { getConfig } from './store'

type HttpResponse = {
  statusCode: number
  headers: https.IncomingHttpHeaders
  body: Buffer
}

// ── 音频播放队列 ──────────────────────────────────────────
let audioQueue: string[] = []          // 待播放的临时 mp3 文件路径
let currentAfplay: ChildProcess | null = null

function playNextInQueue(): void {
  if (currentAfplay || audioQueue.length === 0) return
  const file = audioQueue.shift()!
  console.log(`[aibaji] TTS queue play: ${file} (remaining=${audioQueue.length})`)
  const proc = spawn('afplay', [file])
  currentAfplay = proc
  proc.on('close', () => {
    currentAfplay = null
    fs.unlink(file, () => {})
    playNextInQueue()
  })
  proc.on('error', (e) => {
    console.error('[aibaji] TTS afplay error:', e)
    currentAfplay = null
    fs.unlink(file, () => {})
    playNextInQueue()
  })
}

function enqueueAudioFile(filePath: string): void {
  audioQueue.push(filePath)
  playNextInQueue()
}

export function clearAudioQueue(): void {
  audioQueue.forEach((f) => fs.unlink(f, () => {}))
  audioQueue = []
  if (currentAfplay) {
    currentAfplay.kill()
    currentAfplay = null
  }
}
// ─────────────────────────────────────────────────────────

// ── 文本分段 ──────────────────────────────────────────────
const MIN_SEGMENT_CHARS = 5

function splitText(text: string): string[] {
  // 按中英文逗号、句号切分，保留分隔符在段尾
  const parts = text.split(/(?<=[，。,.])/u).filter((s) => s.trim().length > 0)

  const segments: string[] = []
  for (const part of parts) {
    const charCount = part.replace(/[，。,.]/g, '').replace(/\s/g, '').length
    if (segments.length > 0 && charCount < MIN_SEGMENT_CHARS) {
      segments[segments.length - 1] += part
    } else {
      segments.push(part)
    }
  }
  return segments.filter((s) => s.trim().length > 0)
}
// ─────────────────────────────────────────────────────────

function isLikelyHex(input: string): boolean {
  return input.length > 0 && input.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(input)
}

function httpsPost(url: string, body: string, headers: Record<string, string>): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    }

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        })
      })
      res.on('error', reject)
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function synthesizeSegment(
  segment: string,
  opts: { apiKey: string; model: string; voiceId: string }
): Promise<Buffer | null> {
  const requestBody = JSON.stringify({
    model: opts.model || 'speech-01',
    text: segment,
    stream: false,
    voice_setting: {
      voice_id: opts.voiceId || 'female-tianmei',
      speed: 1.0,
      vol: 1.0,
      pitch: 0,
    },
    audio_setting: {
      audio_sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3',
    },
  })

  const response = await httpsPost(
    'https://api.minimax.chat/v1/t2a_v2',
    requestBody,
    { Authorization: `Bearer ${opts.apiKey}` }
  )

  if (response.statusCode < 200 || response.statusCode >= 300) {
    console.error(`[aibaji] TTS segment failed: status=${response.statusCode}`)
    return null
  }

  try {
    const json = JSON.parse(response.body.toString('utf-8')) as Record<string, unknown>
    const data = json?.data as Record<string, unknown> | undefined
    const baseResp = json?.base_resp as Record<string, unknown> | undefined
    const apiStatus = baseResp?.status_code as number | undefined
    if (apiStatus !== undefined && apiStatus !== 0) {
      console.error(`[aibaji] TTS API error: ${apiStatus}`)
      return null
    }
    const audioRaw = data?.audio as string | undefined
    if (!audioRaw) return null
    return isLikelyHex(audioRaw)
      ? Buffer.from(audioRaw, 'hex')
      : Buffer.from(audioRaw, 'base64')
  } catch {
    return response.body
  }
}

export async function synthesize(text: string, win: BrowserWindow | null, charName?: string): Promise<void> {
  const config = getConfig()
  const cleanedText = text.trim()

  // 解析 TTS 配置
  let apiKey = ''
  let model = ''
  let voiceId = ''

  if (config.ttsProfiles && config.ttsProfiles.length > 0) {
    let profile = config.ttsProfiles[0]
    if (charName) {
      const charProfile = config.characterProfiles?.[charName]
      if (charProfile?.ttsProfileId) {
        const found = config.ttsProfiles.find((p) => p.id === charProfile.ttsProfileId)
        if (found) profile = found
      }
    }
    apiKey = profile.apiKey?.trim() ?? ''
    model = profile.model?.trim() ?? ''
    voiceId = profile.voiceId?.trim() ?? ''

    if (!apiKey && config.tts.enabled && config.tts.apiKey) {
      apiKey = config.tts.apiKey
      model = config.tts.model
      voiceId = config.tts.voiceId
    }
  } else {
    if (!config.tts.enabled || !config.tts.apiKey) return
    apiKey = config.tts.apiKey
    model = config.tts.model
    voiceId = config.tts.voiceId
  }

  if (!apiKey || !cleanedText) {
    console.log('[aibaji] TTS skipped: no apiKey or empty text')
    return
  }

  // 分段
  const segments = splitText(cleanedText)
  console.log(`[aibaji] TTS segments(${segments.length}): ${segments.map((s) => `"${s.slice(0, 10)}"`).join(', ')}`)

  const opts = { apiKey, model, voiceId }

  // 并发合成所有分段，按顺序写文件+入队
  try {
    const buffers = await Promise.all(segments.map((seg) => synthesizeSegment(seg, opts)))

    for (let i = 0; i < buffers.length; i++) {
      const buf = buffers[i]
      if (!buf) continue
      const tmpFile = path.join(os.tmpdir(), `aibaji-tts-${Date.now()}-${i}.mp3`)
      fs.writeFileSync(tmpFile, buf)
      enqueueAudioFile(tmpFile)
    }
  } catch (err) {
    console.error('[aibaji] TTS error:', err)
  }
}
