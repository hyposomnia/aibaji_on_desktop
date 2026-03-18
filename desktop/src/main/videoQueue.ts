import type { BrowserWindow } from 'electron'
import { getConfig } from './store'
import {
  getEmotions,
  getVideoFiles,
  getIdlePool,
} from './characterLoader'

const MAX_QUEUE_SIZE = 5

let win: BrowserWindow | null = null
let currentChar = ''
let currentOutfit = ''
let dataPath = ''
let queue: string[] = []
let isPlaying = false  // true 表示正在播放 emotion 视频（非 idle）
let idlePool: { calm: string[]; other: string[] } = { calm: [], other: [] }

/**
 * 随机选取数组中的一个元素
 */
function randomPick<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 初始化视频队列
 */
export function initVideoQueue(
  window: BrowserWindow,
  dp: string,
  char: string,
  outfit: string
): void {
  win = window
  dataPath = dp
  currentChar = char
  currentOutfit = outfit
  idlePool = getIdlePool(dataPath, currentChar, currentOutfit)
  queue = []
  isPlaying = false
  // 等待渲染层加载完成后再开始 idle（避免 IPC 消息在渲染层就绪前丢失）
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => playIdleVideo())
  } else {
    playIdleVideo()
  }
}

/**
 * 播放下一个队列中的视频
 */
function playNext(): void {
  if (!win) return
  const nextVideo = queue.shift()
  if (nextVideo) {
    isPlaying = true
    win.webContents.send('play-video', nextVideo)
  } else {
    // 队列空，播放 idle
    isPlaying = false
    playIdleVideo()
  }
}

/**
 * 播放 Idle 视频（50% calm，50% other）
 */
function playIdleVideo(): void {
  if (!win) return
  let video: string | null = null

  if (Math.random() < 0.5 && idlePool.calm.length > 0) {
    video = randomPick(idlePool.calm)
  } else if (idlePool.other.length > 0) {
    video = randomPick(idlePool.other)
  } else if (idlePool.calm.length > 0) {
    video = randomPick(idlePool.calm)
  }

  if (video) {
    win.webContents.send('play-video', video)
  }
}

/**
 * 视频播放结束时调用
 */
export function onVideoEnded(): void {
  if (queue.length > 0) {
    playNext()
  } else {
    // 继续 idle 循环
    playIdleVideo()
  }
}

/**
 * 将视频路径直接入队
 */
export function enqueue(videoPath: string): void {
  if (queue.length >= MAX_QUEUE_SIZE) {
    // 丢弃最旧的
    queue.shift()
  }
  queue.push(videoPath)

  // 无论是否在播 idle，都立即切换到 emotion 视频
  isPlaying = false
  playNext()
}

/**
 * 根据表情名解析视频路径并入队
 */
export function enqueueEmotion(emotion: string): void {
  const videoPath = resolveVideo(emotion)
  if (videoPath) {
    enqueue(videoPath)
  }
}

/**
 * 表情→视频匹配
 * 1. 精确匹配
 * 2. 模糊匹配（包含关系）
 * 3. Fallback：calm pool 随机
 */
function resolveVideo(emotion: string): string | null {
  // 1. 精确匹配
  const exactFiles = getVideoFiles(dataPath, currentChar, currentOutfit, emotion)
  if (exactFiles.length > 0) {
    return randomPick(exactFiles)
  }

  // 2. 模糊匹配
  const emotions = getEmotions(dataPath, currentChar, currentOutfit)
  for (const e of emotions) {
    if (e.includes(emotion) || emotion.includes(e)) {
      const files = getVideoFiles(dataPath, currentChar, currentOutfit, e)
      if (files.length > 0) {
        return randomPick(files)
      }
    }
  }

  // 3. Fallback：calm pool
  return randomPick(idlePool.calm) ?? randomPick(idlePool.other)
}

/**
 * 清空队列（切换角色/服装时调用）
 */
export function clearQueue(): void {
  queue = []
  isPlaying = false
}

/**
 * 切换角色和服装
 */
export function setCharacterOutfit(char: string, outfit: string): void {
  currentChar = char
  currentOutfit = outfit
  idlePool = getIdlePool(dataPath, currentChar, currentOutfit)
  clearQueue()
  playIdleVideo()
}
