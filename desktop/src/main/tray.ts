import { Tray, Menu, app, nativeImage } from 'electron'
import * as path from 'path'
import type { MenuItemConstructorOptions } from 'electron'
import { getConfig, setConfig } from './store'
import { getCharacters, getOutfits } from './characterLoader'
import { setCharacterOutfit } from './videoQueue'
import { setLocked, updateScale, getMainWindow } from './window'

let tray: Tray | null = null

/**
 * 创建托盘图标（从 resources/icon.png 加载并缩放到 16x16）
 */
function createTrayIcon(): Electron.NativeImage {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../resources/icon.png')

  try {
    const img = nativeImage.createFromPath(iconPath)
    if (img.isEmpty()) return nativeImage.createEmpty()
    return img.resize({ width: 16, height: 16 })
  } catch {
    return nativeImage.createEmpty()
  }
}

/**
 * 创建大小子菜单
 */
function buildSizeMenu(currentScale: number): MenuItemConstructorOptions[] {
  const scales = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5]
  const labels = ['50%', '60%', '70%', '80%', '90%', '100%', '120%', '150%']

  return scales.map((scale, i): MenuItemConstructorOptions => ({
    label: labels[i],
    type: 'radio',
    checked: Math.abs(currentScale - scale) < 0.01,
    click: () => {
      updateScale(scale)
    },
  }))
}

/**
 * 创建透明度子菜单
 */
function buildOpacityMenu(currentOpacity: number): MenuItemConstructorOptions[] {
  const opacities = [0.2, 0.4, 0.6, 0.8, 1.0]
  const labels = ['20%', '40%', '60%', '80%', '100%']

  return opacities.map((opacity, i): MenuItemConstructorOptions => ({
    label: labels[i],
    type: 'radio',
    checked: Math.abs(currentOpacity - opacity) < 0.01,
    click: () => {
      const win = getMainWindow()
      if (win) {
        win.setOpacity(opacity)
        setConfig({ window: { ...getConfig().window, opacity } })
      }
    },
  }))
}

/**
 * 构建完整的托盘菜单
 */
function buildContextMenu(): Electron.Menu {
  const config = getConfig()
  const { name: currentChar, outfit: currentOutfit, dataPath } = config.character
  const { scale, opacity, locked } = config.window

  // 角色列表
  const characters = getCharacters(dataPath)
  const charMenuItems: MenuItemConstructorOptions[] = characters.map(
    (char): MenuItemConstructorOptions => ({
      label: char,
      type: 'radio',
      checked: char === currentChar,
      click: () => {
        const outfits = getOutfits(dataPath, char)
        const defaultOutfit = outfits[0] || ''
        setConfig({ character: { ...config.character, name: char, outfit: defaultOutfit } })
        setCharacterOutfit(char, defaultOutfit)
        refreshTray()
      },
    })
  )

  // 服装列表
  const outfits = currentChar ? getOutfits(dataPath, currentChar) : []
  const outfitMenuItems: MenuItemConstructorOptions[] = outfits.map(
    (outfit): MenuItemConstructorOptions => ({
      label: outfit,
      type: 'radio',
      checked: outfit === currentOutfit,
      click: () => {
        setConfig({ character: { ...config.character, outfit } })
        setCharacterOutfit(currentChar, outfit)
        refreshTray()
      },
    })
  )

  const template: MenuItemConstructorOptions[] = [
    { label: '爱巴基桌面版', enabled: false },
    { type: 'separator' },
    {
      label: `角色：${currentChar || '未选择'}`,
      submenu: charMenuItems.length > 0 ? charMenuItems : [{ label: '无可用角色', enabled: false }],
    },
    {
      label: `服装：${currentOutfit || '未选择'}`,
      submenu: outfitMenuItems.length > 0 ? outfitMenuItems : [{ label: '无可用服装', enabled: false }],
    },
    { type: 'separator' },
    {
      label: '大小',
      submenu: buildSizeMenu(scale),
    },
    {
      label: '透明度',
      submenu: buildOpacityMenu(opacity),
    },
    { type: 'separator' },
    {
      label: '锁定模式',
      type: 'checkbox',
      checked: locked,
      click: (menuItem) => {
        setLocked(menuItem.checked)
        refreshTray()
      },
    },
    { type: 'separator' },
    { label: '模型与 TTS 设置…', enabled: false },
    { label: '其他设置…', enabled: false },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      },
    },
  ]

  return Menu.buildFromTemplate(template)
}

/**
 * 初始化系统托盘
 */
export function initTray(): Tray {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('爱巴基桌面版')
  tray.setContextMenu(buildContextMenu())

  // 左键点击也显示菜单（Mac 上默认右键显示）
  tray.on('click', () => {
    tray?.popUpContextMenu()
  })

  return tray
}

/**
 * 刷新托盘菜单（角色/服装切换后调用）
 */
export function refreshTray(): void {
  if (!tray) return
  tray.setContextMenu(buildContextMenu())
}
