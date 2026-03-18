import * as https from 'https'
import type { BrowserWindow } from 'electron'
import { getConfig } from './store'

/**
 * 发送 HTTPS POST 请求，返回响应体 Buffer
 */
function httpsPost(url: string, body: string, headers: Record<string, string>): Promise<Buffer> {
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
      res.on('end', () => resolve(Buffer.concat(chunks)))
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
export async function synthesize(text: string, win: BrowserWindow): Promise<void> {
  const config = getConfig()
  const { enabled, apiKey, model, voiceId } = config.tts

  // TTS 未启用或无 API Key，静默跳过
  if (!enabled || !apiKey || !text.trim()) {
    return
  }

  try {
    const requestBody = JSON.stringify({
      model: model || 'speech-01',
      text,
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

    const responseBuffer = await httpsPost(
      'https://api.minimax.chat/v1/t2a_v2',
      requestBody,
      {
        Authorization: `Bearer ${apiKey}`,
      }
    )

    // 解析响应
    const responseText = responseBuffer.toString('utf-8')
    let audioBase64: string | null = null

    try {
      // 尝试 JSON 响应（包含 base64 音频数据）
      const json = JSON.parse(responseText) as Record<string, unknown>
      // MiniMax API 可能返回 data.audio（hex 字符串）
      const audioHex = (json?.data as Record<string, unknown>)?.audio as string | undefined
      if (audioHex) {
        // hex 转 base64
        audioBase64 = Buffer.from(audioHex, 'hex').toString('base64')
      }
    } catch {
      // 不是 JSON，可能是直接的二进制 mp3 数据
      audioBase64 = responseBuffer.toString('base64')
    }

    if (audioBase64 && win && !win.isDestroyed()) {
      win.webContents.send('play-audio', audioBase64)
    }
  } catch (err) {
    // 静默跳过 TTS 错误，不影响主流程
    console.error('[aibaji] TTS error:', err)
  }
}
