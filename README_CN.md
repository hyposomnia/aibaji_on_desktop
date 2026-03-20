# 爱巴基桌面版

[English](README.md)

### 项目介绍

爱巴基桌面版是一个 Electron 桌面伴侣应用，配合 Claude Code Hook 插件使用。当 Claude Code 工作时（执行工具、完成任务、发送通知等），Hook 插件将事件发送给本地桌面应用，应用通过 LLM 将事件转述为角色台词，并播放对应表情的透明视频，可选开启 TTS 朗读。

**工作流程：**

```
Claude Code 工作事件
  → Hook 插件 (forward.sh) POST 到 localhost:5287
  → Electron 主进程接收事件
  → LLM 解析事件，输出 [表情] + 台词
  → 播放对应表情的透明角色视频
  → （可选）MiniMax TTS 朗读台词
```

### 目录结构

```
aibaji_on_desktop/
├── desktop/          # Electron 应用主体
│   ├── src/
│   │   ├── main/     # 主进程（server、llm、tts、window 等）
│   │   ├── preload/  # IPC 桥接
│   │   └── renderer/ # 渲染进程（视频播放 + 设置页）
│   └── resources/    # 应用图标
├── plugin/           # Claude Code Hook 插件
│   └── hooks/
│       └── forward.sh  # 事件转发脚本
└── characters/       # 角色视频素材
    └── 角色名/
        └── 服装名/
            └── 表情名[数字].webm
```

### 安装使用

#### 1. 安装桌面应用

从 [Releases](../../releases) 下载最新的 `.dmg` 文件（macOS），安装后启动应用。

或从源码构建：

```bash
cd desktop
npm install
npm run pack   # 生成 dist/爱巴基桌面版-*.dmg
```

#### 2. 安装 Claude Code 插件

在 Claude Code 中执行：

```
/plugin marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji
```

#### 3. 准备角色视频素材

角色视频放置在以下目录（应用启动后会自动识别）：

- **打包版**：与 `.app` 同级的 `characters/` 目录，或应用内置资源
- **开发版**：仓库根目录的 `characters/` 目录

目录结构示例：

```
characters/
└── 昔涟/
    └── 白色短裙/
        ├── 平静1.1.webm
        ├── 平静1.2.webm
        ├── 微笑.webm
        ├── 开心.webm
        ├── 惊讶.webm
        └── 愤怒.webm
```

视频文件需为带透明通道的 `.webm` 格式（VP9 编码）。

#### 4. 配置应用

首次启动后，点击系统托盘图标，选择「设置」，配置以下内容：

**角色设置**
- 选择角色与服装
- 设置 dataPath（角色视频根目录，默认为应用内置路径）

**LLM 设置**（必须）

| 选项 | 说明 |
|------|------|
| API 模式 | `openai`（兼容 OpenAI 接口）或 `anthropic` |
| API Key | 对应平台的 API 密钥 |
| Base URL | OpenAI 模式下的自定义接口地址（可使用中转） |
| 模型 | 如 `gpt-4o-mini`、`claude-haiku-4-5-20251001` |
| 角色 Persona | LLM 扮演角色时的人设描述 |

**TTS 设置**（可选）

| 选项 | 说明 |
|------|------|
| 启用 TTS | 是否朗读台词 |
| Provider | 目前支持 MiniMax |
| API Key | MiniMax 平台 API 密钥 |
| 模型 | 如 `speech-01` |
| Voice ID | MiniMax 音色 ID |

**窗口设置**
- 大小缩放、透明度调节
- 锁定/解锁（锁定后鼠标可穿透窗口）

配置文件保存于：`~/Library/Application Support/aibaji-desktop/config.json`

### 开发

```bash
cd desktop
npm install
npm run dev        # 开发模式（热重载）
npm run typecheck  # TypeScript 类型检查
npm run build      # 构建生产版本
npm run pack       # 打包 DMG
```

### 视频命名规范

- 文件名去掉扩展名、末尾数字后为表情名，如 `平静1.1.webm` → 表情 `平静1`
- 表情名以 `平静` 开头的归入 idle calm 池，其余归入 idle other 池
- idle 状态下两个池各 50% 概率随机播放
