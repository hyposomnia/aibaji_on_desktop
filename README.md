# Aibaji Desktop

[中文文档](README_CN.md)

### Overview

Aibaji Desktop is an Electron companion app for Claude Code. When Claude Code is working (running tools, completing tasks, sending notifications, etc.), a hook plugin forwards events to the local desktop app. The app uses an LLM to interpret each event into character dialogue, then plays a transparent animated character video with a matching expression. Optional TTS (text-to-speech) is also supported.

**How it works:**

```
Claude Code event
  → Hook plugin (forward.sh) POST to localhost:5287
  → Electron main process receives event
  → LLM generates [expression] + dialogue line
  → Transparent character video with matching expression plays
  → (Optional) MiniMax TTS reads the dialogue aloud
```

### Repository Structure

```
aibaji_on_desktop/
├── desktop/          # Electron application
│   ├── src/
│   │   ├── main/     # Main process (server, llm, tts, window, etc.)
│   │   ├── preload/  # IPC bridge
│   │   └── renderer/ # Renderer (video player + settings page)
│   └── resources/    # App icon
├── plugin/           # Claude Code hook plugin
│   └── hooks/
│       └── forward.sh  # Event forwarding script
└── characters/       # Character video assets
    └── character-name/
        └── outfit-name/
            └── expression-name[number].webm
```

### Installation

#### 1. Install the desktop app

Download the latest `.dmg` from [Releases](../../releases) (macOS), install, and launch.

Or build from source:

```bash
cd desktop
npm install
npm run pack   # outputs dist/爱巴基桌面版-*.dmg
```

#### 2. Install the Claude Code plugin

Run inside Claude Code:

```
/plugin marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji
```

#### 3. Prepare character video assets

Place character videos in a directory the app can find:

- **Packaged app**: a `characters/` folder next to the `.app`, or bundled resources
- **Dev mode**: the `characters/` directory at the repo root

Directory structure example:

```
characters/
└── Xilian/
    └── WhiteDress/
        ├── calm1.1.webm
        ├── calm1.2.webm
        ├── smile.webm
        ├── happy.webm
        ├── surprised.webm
        └── angry.webm
```

Videos must be `.webm` files with an alpha channel (VP9 codec).

#### 4. Configure the app

After first launch, click the system tray icon and open Settings:

**Character**
- Select character and outfit
- Set `dataPath` (root directory of character videos; defaults to the bundled path)

**LLM** (required)

| Option | Description |
|--------|-------------|
| API Mode | `openai` (OpenAI-compatible) or `anthropic` |
| API Key | Your API key for the chosen platform |
| Base URL | Custom endpoint for OpenAI mode (supports proxies) |
| Model | e.g. `gpt-4o-mini`, `claude-haiku-4-5-20251001` |
| Persona | Character personality description for the LLM |

**TTS** (optional)

| Option | Description |
|--------|-------------|
| Enable TTS | Whether to read dialogue aloud |
| Provider | Currently supports MiniMax |
| API Key | MiniMax platform API key |
| Model | e.g. `speech-01` |
| Voice ID | MiniMax voice ID |

**Window**
- Scale and opacity controls
- Lock/unlock (when locked, mouse clicks pass through the window)

Config is saved at: `~/Library/Application Support/aibaji-desktop/config.json`

### Development

```bash
cd desktop
npm install
npm run dev        # Dev mode with hot reload
npm run typecheck  # TypeScript type check (no output)
npm run build      # Production build
npm run pack       # Package as DMG
```

### Video Naming Convention

- Expression name = filename minus extension and trailing digits. e.g. `calm1.1.webm` → expression `calm1`
- Expressions starting with `平静` (calm) go into the idle calm pool; all others go into the idle other pool
- During idle, each pool has a 50% chance of being picked for the next video
