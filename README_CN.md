# 爱巴基桌面版

让 Claude Code 拥有一个透明悬浮的二次元角色伴侣。Claude Code 工作时，角色会根据当前状态说话、切换表情、播放动画，可选 TTS 朗读台词。

[English](README.md) | [繁體中文](README_TW.md) | [日本語](README_JA.md)

---

## 工作原理

```
Claude Code 触发 Hook 事件
  → 插件 forward.sh 将事件映射为语义消息，异步 POST 到 localhost:5287
  → 桌面应用接收消息
  → 调用 LLM 生成 [表情] + 台词
  → 播放对应表情的透明 webm 视频
  → （可选）MiniMax TTS 朗读台词
```

---

## 插件说明

`plugin/` 目录是一个 Claude Code Hook 插件，安装后会在以下六类事件触发时自动将事件转发到本地桌面应用：

| 事件 | 触发时机 | 发送的消息 |
|------|----------|------------|
| `UserPromptSubmit` | 用户发送消息时 | `Your instruction has been received.` |
| `PreToolUse` | 工具调用前 | `Prepare to use {工具名}` |
| `PostToolUse` | 工具调用后 | `{工具名} finished` |
| `Stop` | 回复结束时 | `Task complete` |
| `Notification`（权限类） | Claude Code 发出权限相关通知时 | `Need your confirmation to {通知内容}` |
| `Notification`（其他） | Claude Code 发出普通通知时 | `{通知内容}` |
| `PermissionRequest` | 请求工具权限时 | `Need your authentication to use {工具名} ({说明})` |

插件只转发语义摘要，不会转发工具参数、执行结果、代码 diff 等大体积内容。内置限速：60 秒滑动窗口内最多转发 5 次。始终 `exit 0`，不阻塞 Claude Code。

---

## 安装

### 第一步：安装桌面应用

从 [Releases](../../releases) 下载最新的 `.dmg`，安装并启动。

或从源码构建：

```bash
cd desktop
npm install
npm run pack   # 输出 desktop/dist/爱巴基桌面版-*.dmg
```

### 第二步：安装 Claude Code 插件

在 Claude Code 中依次执行：

```
/plugins marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji_on_desktop
```

安装完成后无需重启，下一次工具调用即开始转发事件。

---

## 准备角色视频资源

桌面应用需要一组带透明通道的 `.webm` 视频文件作为角色素材。

演示资源可从以下仓库下载：[aibaji_on_desktop_resources](https://github.com/hyposomnia/aibaji_on_desktop_resources)

### 目录结构

```
characters/
└── 角色名/
    └── 服装名/
        ├── 平静1.1.webm
        ├── 平静1.2.webm
        ├── 微笑.webm
        ├── 开心.webm
        ├── 惊讶.webm
        └── 生气.webm
```

### 文件要求

- 格式：`.webm`，VP9 编码，**必须带 Alpha 通道**（透明背景）
- 文件名即表情名，末尾数字为同表情多版本编号（播放时随机选取）
  - 例：`平静1.1.webm`、`平静1.2.webm` → 表情名均为 `平静1`
- 表情名以 `平静` 开头的视频归入空闲动画池（calm pool），其余归入 other pool，空闲时各以 50% 概率随机播放

### 资源路径

首次启动桌面应用时会弹出文件夹选择窗口，选择包含角色子目录的 `characters/` 根目录即可。之后可在设置页 → 角色选项卡中修改。

---

## 配置参数

首次启动后点击系统托盘图标，进入「设置」页面完成以下配置。

配置文件保存于：`~/Library/Application Support/aibaji-desktop/config.json`

### LLM 配置（必填）

角色台词由 LLM 实时生成，必须配置一个可用的 LLM。

| 参数 | 说明 |
|------|------|
| API 模式 | `openai`（兼容 OpenAI 格式，支持代理/国产模型）或 `anthropic` |
| API Key | 对应平台的 API Key |
| Base URL | 仅 `openai` 模式需要，填写 API 端点地址；留空则使用官方地址 |
| 模型 | 例：`gpt-4o-mini`、`claude-haiku-4-5-20251001` |
| 角色名称 | 配置的名称标识，便于管理多个配置 |

> LLM 的回复格式要求为 `[表情名]台词内容`，应用会自动解析并匹配视频。可用表情由当前角色的视频文件名自动提取。

### TTS 配置（可选）

启用后会将 LLM 生成的台词通过语音播放出来。

| 参数 | 说明 |
|------|------|
| 名称 | 配置的名称标识 |
| 供应商 | 目前仅支持 MiniMax |
| API Key | MiniMax 平台 API Key |
| 模型 | 例：`speech-01` |
| Voice ID | MiniMax 音色 ID |

### 角色配置

| 参数 | 说明 |
|------|------|
| 人设 | 传给 LLM 的角色描述，例：`傲娇的猫娘` |
| LLM 模型 | 为该角色指定使用哪套 LLM 配置（默认用第一个） |
| TTS 模型 | 为该角色指定使用哪套 TTS 配置（默认用第一个） |

### 窗口配置

| 参数 | 说明 |
|------|------|
| 缩放比例 | 调整角色窗口大小 |
| 透明度 | 调整窗口整体透明度 |
| 锁定 | 锁定后鼠标点击穿透窗口，适合专注工作时使用 |
| 重置窗口位置 | 将窗口移动到当前光标所在屏幕的正中间（切换显示器或分辨率变化后找回窗口） |

**交互手势**

- **拖拽**：在角色窗口任意位置按住鼠标左键拖动，可自由移动窗口位置
- **双击**：非锁定状态下双击角色，随机切换为当前角色的其他服装

### 服务端配置（高级）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| Token | 空 | 启用后插件须携带相同 Token，否则请求被拒绝；插件 `config.json` 中的 `token` 字段需与此保持一致 |
| 限速窗口 | `60000` ms | 客户端限速时间窗口 |
| 窗口内上限 | `5` | 时间窗口内最多处理的事件数 |

---

## 插件配置（可选）

插件目录下的 `plugin/config.json` 可覆盖默认转发行为：

```json
{
  "server_url": "http://localhost:5287",
  "token": "",
  "events": ["PreToolUse", "PostToolUse", "Stop", "Notification", "UserPromptSubmit", "PermissionRequest"],
  "include_content": false,
  "messages": {
    "PreToolUse": "Prepare to use {tool}",
    "PostToolUse": "{tool} finished",
    "Stop": "Task complete",
    "Notification": "{msg}",
    "NotificationPermission": "Need your confirmation to {msg}",
    "PermissionRequest": "Need your authentication to use {tool} ({msg})",
    "UserPromptSubmit": "Your instruction has been received."
  },
  "notification_permission_keywords": ["permission", "allow", "deny", "approv", "confirm", "authoriz"]
}
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `server_url` | `http://localhost:5287` | 桌面应用地址，远程部署时修改 |
| `token` | 空 | 与桌面应用服务端 Token 保持一致 |
| `events` | 全部六类 | 只转发列表中的事件类型 |
| `messages` | 见上方 | 各事件的消息模板，支持 `{tool}`、`{msg}` 占位符 |
| `notification_permission_keywords` | 见上方 | 识别权限类通知的关键词列表 |
| `include_content` | `false` | 预留字段 |

---

## 开发

```bash
cd desktop
npm install
npm run dev        # 开发模式（热重载）
npm run typecheck  # TypeScript 类型检查
npm run build      # 生产构建
npm run pack       # 打包为 DMG
```
