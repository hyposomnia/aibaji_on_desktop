import * as https from 'https'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawn } from 'child_process'
import type { BrowserWindow } from 'electron'
import { getConfig } from './store'

type HttpResponse = {
  statusCode: number
  headers: https.IncomingHttpHeaders
  body: Buffer
}

function isLikelyHex(input: string): boolean {
  return input.length > 0 && input.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(input)
}

/**
 * 发送 HTTPS POST 请求，返回状态码、响应头和响应体
 */
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

/**
 * 调用 MiniMax TTS API，将文本转换为语音并发送给渲染进程播放
 *
 * MiniMax T2A V2 API 文档参考：
 * POST https://api.minimax.chat/v1/t2a_v2
 *
 * @param text 要转换的文本
 * @param win Electron 渲染窗口
 */
export async function synthesize(text: string, win: BrowserWindow | null, charName?: string): Promise<void> {
  const config = getConfig()
  const cleanedText = text.trim()

  // 优先使用 ttsProfiles（新配置）；按角色查找，没有则用第一个
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

    // 若新配置存在但未填 key，退回旧配置，避免“有 profile 但无法发声”
    if (!apiKey && config.tts.enabled && config.tts.apiKey) {
      apiKey = config.tts.apiKey
      model = config.tts.model
      voiceId = config.tts.voiceId
    }
  } else {
    // fallback 到旧 config.tts
    if (!config.tts.enabled || !config.tts.apiKey) return
    apiKey = config.tts.apiKey
    model = config.tts.model
    voiceId = config.tts.voiceId
  }

  // TTS 未配置 API Key，静默跳过
  if (!apiKey || !cleanedText) {
    console.log('[aibaji] TTS skipped: no apiKey or empty text')
    return
  }
  console.log(`[aibaji] TTS synthesize: model=${model}, voiceId=${voiceId}, text="${cleanedText.slice(0, 20)}..."`)


  try {
    const requestBody = JSON.stringify({
      model: model || 'speech-01',
      text: cleanedText,
      stream: false,
      voice_setting: {
        voice_id: voiceId || 'female-tianmei',
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
      {
        Authorization: `Bearer ${apiKey}`,
      }
    )

    console.log(`[aibaji] TTS http: status=${response.statusCode}, content-type=${response.headers['content-type'] ?? 'unknown'}`)

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const errPreview = response.body.toString('utf-8').slice(0, 300)
      console.error(`[aibaji] TTS request failed: status=${response.statusCode}, body=${errPreview}`)
      return
    }

    // 解析响应
    const responseText = response.body.toString('utf-8')
    console.log(`[aibaji] TTS response (first 200): ${responseText.slice(0, 200)}`)
    let audioBase64: string | null = null

    try {
      const json = JSON.parse(responseText) as Record<string, unknown>
      const data = json?.data as Record<string, unknown> | undefined
      const baseResp = json?.base_resp as Record<string, unknown> | undefined
      const apiStatus = baseResp?.status_code as number | undefined
      const apiMsg = baseResp?.status_msg as string | undefined
      const audioRaw = data?.audio as string | undefined
      console.log(`[aibaji] TTS json keys: ${Object.keys(json)}, data keys: ${data ? Object.keys(data) : 'none'}, audio length: ${audioRaw?.length ?? 0}`)

      if (apiStatus !== undefined && apiStatus !== 0) {
        console.error(`[aibaji] TTS API error: status_code=${apiStatus}, status_msg=${apiMsg ?? 'unknown'}`)
        return
      }

      if (audioRaw) {
        if (isLikelyHex(audioRaw)) {
          audioBase64 = Buffer.from(audioRaw, 'hex').toString('base64')
        } else {
          // 兼容部分接口直接返回 base64
          audioBase64 = audioRaw
        }
        console.log(`[aibaji] TTS base64 length: ${audioBase64.length}`)
      }
    } catch {
      console.log(`[aibaji] TTS response is not JSON, treating as binary`)
      audioBase64 = response.body.toString('base64')
    }

    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, 'base64')
      const tmpFile = path.join(os.tmpdir(), `aibaji-tts-${Date.now()}.mp3`)
      fs.writeFileSync(tmpFile, audioBuffer)
      console.log(`[aibaji] TTS playing via afplay: ${tmpFile}`)
      const proc = spawn('afplay', [tmpFile])
      proc.on('close', () => {
        fs.unlink(tmpFile, () => {})
      })
      proc.on('error', (e) => {
        console.error('[aibaji] TTS afplay error:', e)
        fs.unlink(tmpFile, () => {})
      })
    } else {
      console.log(`[aibaji] TTS no audio to send`)
    }
  } catch (err) {
    // 静默跳过 TTS 错误，不影响主流程
    console.error('[aibaji] TTS error:', err)
  }
}
