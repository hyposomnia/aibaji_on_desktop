# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

爱巴基桌面版（aibaji_desktop）：Claude Code 通过 Hook 插件将工作状态映射为语义消息，POST 到本地 Electron 桌面应用（端口 5287），应用调用 LLM 转述后播放角色透明视频，可选 TTS 朗读。

仓库结构：
- `characters/` — 角色视频素材（角色/服装/*.webm），不进 Electron 打包，由 extraResources 引入
- `desktop/` — Electron 应用主体
- `plugin/` — Claude Code Hook 插件（forward.sh + config.json）
- `plugin-openclaw/` — OpenClaw Hook 插件（install.sh 一键安装，支持多 agent 多实例）

## 常用命令

所有命令在 `desktop/` 目录下执行：

```bash
cd desktop
npm run dev        # 开发模式（热重载）
npm run build      # 构建生产版本
npm run pack       # 打包 DMG（输出 dist/aibaji_desktop-*.dmg）
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
  ├── store.ts           配置持久化（electron-store v10，ESM-only，必须动态 import）
  ├── characterLoader.ts 扫描 dataPath/角色/服装/*.webm，提取表情名
  ├── window.ts          透明悬浮窗口（transparent/frame:false/alwaysOnTop）
  ├── server.ts          Express HTTP 服务（:5287），接收 Hook 事件，滑动窗口限速
  ├── tray.ts            系统托盘菜单（角色/服装/大小/透明度/锁定/居中/退出）
  ├── videoQueue.ts      FIFO 视频队列（上限5）+ Idle 循环
  ├── llm.ts             LLM 转述（OpenAI 兼容 / Anthropic，流式解析 [表情]台词）
  ├── tts.ts             MiniMax TTS（可选，HTTP API，hex→base64→play-audio IPC）
  └── settings.ts        设置窗口（独立 BrowserWindow）
```

### Renderer 组件结构

```
App.tsx
  ├── VideoPlayer.tsx    透明视频播放 + 自定义拖拽 + 双击换装
  ├── FloatingMenu.tsx   右键浮动菜单（角色/服装/大小/透明度/锁定）
  └── SettingsPage.tsx   设置页面（角色/LLM/TTS/通用/服务端）
      └── i18n.ts        四语言翻译（en/zh-CN/zh-TW/ja）
```

### IPC 通信

preload 通过 `contextBridge` 暴露 `window.electronAPI`：

| 方向 | 信道 | 用途 |
|---|---|---|
| main→renderer | `play-video` | 发送视频文件绝对路径 |
| main→renderer | `play-audio` | 发送 base64 mp3 |
| main→renderer | `update-lock-state` | 同步锁定状态到 renderer |
| main→renderer | `need-setup` | 首次启动触发 setup 弹窗 |
| renderer→main | `video-ended` | 通知队列播下一个 |
| renderer→main | `renderer-ready` | IPC 监听注册完毕，可开始播放 |
| renderer→main | `get-config` / `set-config` | 配置读写 |
| renderer→main | `update-window-config` | 修改缩放/透明度/锁定（触发实际窗口变化） |
| renderer→main | `set-ignore-mouse-events` | 鼠标穿透开关 |
| renderer→main | `get-window-position` | 获取当前窗口坐标（自定义拖拽用） |
| renderer→main | `set-window-position` | 设置窗口坐标（自定义拖拽用） |
| renderer→main | `center-window` | 将窗口移到当前光标所在屏幕正中间 |
| renderer→main | `set-character` | 切换角色/服装 |
| renderer→main | `random-outfit` | 随机切换当前角色的服装（双击触发） |
| renderer→main | `open-settings` | 打开设置窗口 |
| renderer→main | `get-autostart` / `set-autostart` | 开机自启动读写 |
| renderer→main | `quit` | 退出应用 |

### 视频文件命名规范

`表情名[数字后缀].webm`，例：`平静1.1.webm`、`微笑.webm`

表情名提取：`filename.replace(/\.\w+$/, '').replace(/[\d.]+$/, '').trim()`

Idle 池：表情名以"平静"开头归入 calm pool，其余归 other pool，各 50% 概率随机播。

### 自定义拖拽机制

`-webkit-app-region: drag` 在 macOS 上会拦截所有 JS 鼠标事件（包括 dblclick），因此改用自定义拖拽：

- body 始终设为 `webkitAppRegion: no-drag`
- `onMouseDown`：异步获取当前窗口坐标，记录拖拽起点
- `window.mousemove`：计算偏移量，调用 `set-window-position` IPC 移动窗口（移动 >2px 才标记为"真拖拽"）
- `onDoubleClick`：非拖拽 + 非锁定时调用 `random-outfit`

### 关键实现细节

- **electron-store v10**：ESM-only，必须 `await import('electron-store')` 动态导入，不能静态 import
- **透明窗口视频**：dev 模式需 `webSecurity: false`（localhost 加载 file:// 视频），生产模式开启
- **中文路径**：视频 src 必须 `encodeURI('file://' + path)`
- **IPC 时序**：renderer 发 `renderer-ready` 后，main 才调用 `initVideoQueue` 开始播放
- **托盘菜单**：submenu 必须用 `MenuItemConstructorOptions[]`，不能用 `new MenuItem()`
- **锁定模式**：锁定时 `handleMouseDown` 直接 return，禁止拖拽；解锁时恢复
- **LLM 日志脱敏**：apiKey 在日志中显示为 `***`

### Hook 插件

**Claude Code（`plugin/`）**

`plugin/hooks/forward.sh` 从 stdin 读取事件 JSON，根据 `plugin/config.json` 中的 `messages` 模板将事件映射为语义消息，异步 curl POST 到 `http://localhost:5287/event`，始终 exit 0 不阻塞 Claude Code。

事件类型：`PreToolUse`、`PostToolUse`、`Stop`、`Notification`、`UserPromptSubmit`、`PermissionRequest`

限速：60 秒滑动窗口内最多转发 5 次（插件端与服务端各自独立限速）。

Claude Code 插件安装：
```
/plugins marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji_on_desktop
```

**OpenClaw（`plugin-openclaw/`）**

`plugin-openclaw/install.sh` 完全自包含，一条命令从 git 安装并自动注册 hook：

```bash
curl -fsSL https://raw.githubusercontent.com/hyposomnia/aibaji_on_desktop/main/plugin-openclaw/install.sh \
  | bash -s -- <agentId> [port]
```

- `agentId`：对应 `~/.openclaw/workspace-<agentId>` 目录
- `port`：爱巴基实例监听端口，默认 5287
- 安装后若 `openclaw` 在 PATH 中，自动执行 `openclaw hooks enable aibaji --workspace <path>`

事件映射：`command:new` / `message:received` → UserPromptSubmit，`command:stop` / `message:sent` → Stop，`tool_result_persist` → PostToolUse

### 多实例支持

`requestSingleInstanceLock` 已移除。不同实例通过 `--user-data-dir` 启动参数指向不同目录，各自维护独立 config（含不同端口）：

```bash
# 实例 2（port 5288）
open -n /Applications/aibaji_desktop.app --args \
  --user-data-dir="$HOME/Library/Application Support/aibaji-work"
```
