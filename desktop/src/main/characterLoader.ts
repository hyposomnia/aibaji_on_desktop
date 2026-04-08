import * as fs from 'fs'
import * as path from 'path'

/**
 * 从文件名提取表情名
 * 例：平静1.1.webm → 平静，微笑.mp4 → 微笑
 */
function extractEmotion(filename: string): string {
  // 去掉扩展名
  const nameWithoutExt = filename.replace(/\.\w+$/, '')
  // 去掉末尾的数字和小数点（如 1.1, 2, 1.2 等）
  const emotion = nameWithoutExt.replace(/[\d.]+$/, '').trim()
  return emotion
}

/**
 * 获取目录下的所有子目录名
 */
function listDirs(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * 获取目录下的所有视频文件名（.webm / .mp4）
 */
function listVideoFiles(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((f) => f.isFile() && (f.name.endsWith('.webm') || f.name.endsWith('.mp4')))
      .map((f) => f.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * 列出 dataPath 下的所有角色名
 */
export function getCharacters(dataPath: string): string[] {
  return listDirs(dataPath)
}

/**
 * 列出角色下的所有服装名
 */
export function getOutfits(dataPath: string, char: string): string[] {
  return listDirs(path.join(dataPath, char))
}

/**
 * 列出角色+服装下的去重表情名列表
 */
export function getEmotions(dataPath: string, char: string, outfit: string): string[] {
  const dir = path.join(dataPath, char, outfit)
  const files = listVideoFiles(dir)
  const emotionSet = new Set(files.map(extractEmotion).filter((e) => e.length > 0))
  return Array.from(emotionSet).sort()
}

/**
 * 返回匹配表情名的所有视频文件完整路径
 */
export function getVideoFiles(
  dataPath: string,
  char: string,
  outfit: string,
  emotion: string
): string[] {
  const dir = path.join(dataPath, char, outfit)
  const files = listVideoFiles(dir)
  return files
    .filter((f) => extractEmotion(f) === emotion)
    .map((f) => path.join(dir, f))
}

/**
 * 获取 Idle 视频池
 * calm: 以"平静"开头的视频文件路径
 * other: 其余视频文件路径
 */
export function getIdlePool(
  dataPath: string,
  char: string,
  outfit: string
): { calm: string[]; other: string[] } {
  const dir = path.join(dataPath, char, outfit)
  const files = listVideoFiles(dir)
  const calm: string[] = []
  const other: string[] = []

  for (const f of files) {
    const fullPath = path.join(dir, f)
    const emotion = extractEmotion(f)
    if (emotion.startsWith('平静')) {
      calm.push(fullPath)
    } else {
      other.push(fullPath)
    }
  }

  return { calm, other }
}
