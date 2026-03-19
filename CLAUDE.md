# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

爱巴基桌面版：Claude Code 通过 Hook 插件将工作状态（PreToolUse/PostToolUse/Stop/Notification/UserPromptSubmit）发送到本地 Electron 桌面应用（端口 5287），应用调用 LLM 转述后播放角色透明视频，可选 TTS 朗读。

仓库结构：
- `characters/` — 角色视频素材（角色/服装/*.webm），不进 Electron 打包时由 extraResources 引入
- `desktop/` — Electron 应用主体
- `plugin/` — Claude Code Hook 插件

## 常用命令

所有命令在 `desktop/` 目录下执行：

```bash
cd desktop
npm run dev        # 开发模式（热重载）
npm run build      # 构建生产版本
npm run pack       # 打包 DMG/NSIS
npm run typecheck  # TypeScript 类型检查（无编译输出）
```

配置文件路径（运行时）：`~/Library/Application Support/aibaji-desktop/config.json`

## 架构

### Electron 三段构建（electron-vite）

| 段 | 入口 | 输出 |
|---|---|---|
| main | `src/main/index.ts` | `dist-electron/main/` |
| preload | `src/preload/index.ts` | `dist-electron/preload/` |
| renderer | `src/renderer/index.html` | `dist/` |

### Main 进程模块依赖关系

```
index.ts（入口）
  ├── store.ts         配置持久化（electron-store v10，ESM-only，必须动态 import）
  ├── characterLoader.ts  扫描 dataPath/角色/服装/*.webm，提取表情名
  ├── window.ts        透明悬浮窗口（transparent/frame:false/alwaysOnTop）
  ├── server.ts        Express HTTP 服务（:5287），接收 Hook 事件，3s 节流
  ├── tray.ts          系统托盘菜单（角色/服装/大小/透明度/锁定）
  ├── videoQueue.ts    FIFO 视频队列（上限5）+ Idle 循环
  ├── llm.ts           LLM 转述（OpenAI 兼容 / Anthropic，流式解析 [表情]台词）
  └── tts.ts           MiniMax TTS（可选，HTTP API，hex→base64→play-audio IPC）
```

### IPC 通信

preload 通过 `contextBridge` 暴露 `window.electronAPI`：

| 方向 | 信道 | 用途 |
|---|---|---|
| main→renderer | `play-video` | 发送视频文件绝对路径 |
| main→renderer | `play-audio` | 发送 base64 mp3 |
| main→renderer | `update-lock-state` | 锁定/解锁鼠标穿透 |
| renderer→main | `video-ended` | 通知队列播下一个 |
| renderer→main | `get-config` / `set-config` | 配置读写 |

### 视频文件命名规范

`表情名[数字后缀].webm`，例：`平静1.1.webm`、`微笑.webm`

表情名提取：`filename.replace(/\.\w+$/, '').replace(/[\d.]+$/, '').trim()`

Idle 池：文件名表情以"平静"开头归入 calm pool，其余归 other pool，各 50% 概率随机播。

### 关键实现细节

- **electron-store v10**：ESM-only，必须 `await import('electron-store')` 动态导入，不能静态 import
- **透明窗口视频**：dev 模式需 `webSecurity: false`（localhost 加载 file:// 视频），生产模式开启
- **中文路径**：视频 src 必须 `encodeURI('file://' + path)`
- **IPC 时序**：`initVideoQueue` 需等 `did-finish-load` 后再发 `play-video`
- **托盘菜单**：submenu 必须用 `MenuItemConstructorOptions[]`，不能用 `new MenuItem()`

### Hook 插件

`plugin/hooks/forward.sh` 从 stdin 读取事件 JSON，异步 curl POST 到 `http://localhost:5287/event`，始终 exit 0 不阻塞 Claude Code。

Claude Code 插件安装：
```
/plugin marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji
```
