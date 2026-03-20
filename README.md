# Aibaji Desktop

Give Claude Code a transparent floating anime companion. While Claude Code is working, the character reacts to its current state — speaking, switching expressions, and playing animations — with optional TTS narration.

[中文文档](README_CN.md)

---

## How It Works

```
Claude Code triggers a Hook event
  → Plugin forward.sh async POSTs to localhost:5287
  → Desktop app receives the event
  → LLM generates [expression] + dialogue
  → Matching transparent webm video plays
  → (Optional) MiniMax TTS reads the dialogue aloud
```

---

## Plugin

The `plugin/` directory is a Claude Code Hook plugin. Once installed, it automatically forwards event JSON to the local desktop app when any of the following events fire:

| Event | When it fires | What is forwarded |
|-------|---------------|-------------------|
| `UserPromptSubmit` | User sends a message | User's message text (code blocks stripped) |
| `PreToolUse` | Before a tool is called | Tool name |
| `PostToolUse` | After a tool completes | Tool name |
| `Stop` | Claude Code finishes responding | Mapped to "Task complete" |
| `Notification` | Claude Code sends a notification | Notification text; permission/auth type mapped to "User action required" |
| `PermissionRequest` | Tool permission is requested | Mapped to "User authorization required: {tool}" |

The plugin never forwards tool arguments, execution results, or code diffs. Built-in rate limit: 5 events per 60-second sliding window. Always exits `0` — never blocks Claude Code.

---

## Installation

### Step 1: Install the Desktop App

Download the latest `.dmg` from [Releases](../../releases), install, and launch.

Or build from source:

```bash
cd desktop
npm install
npm run pack   # outputs desktop/dist/Aibaji-*.dmg
```

### Step 2: Install the Claude Code Plugin

Inside Claude Code, run these two commands:

```
/plugin marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji_on_desktop
```

No restart required. The plugin takes effect on the next tool call.

---

## Character Video Assets

The desktop app requires a set of `.webm` video files with an alpha channel as character assets.

### Directory Structure

```
characters/
└── CharacterName/
    └── OutfitName/
        ├── calm1.1.webm
        ├── calm1.2.webm
        ├── smile.webm
        ├── happy.webm
        ├── surprised.webm
        └── angry.webm
```

### File Requirements

- Format: `.webm`, VP9 codec, **must have an alpha channel** (transparent background)
- The filename (minus extension and trailing digits) is the expression name
  - e.g. `calm1.1.webm`, `calm1.2.webm` → expression name is `calm1`
- Expressions starting with `平静` (calm) go into the idle calm pool; all others go into the other pool. During idle, each pool has a 50% chance of being picked

### Asset Path

On first launch, a folder picker appears. Select the root `characters/` directory that contains the character subdirectories. This can be changed later in Settings → Character tab.

---

## Configuration

After first launch, click the system tray icon and open **Settings**.

Config file location: `~/Library/Application Support/aibaji-desktop/config.json`

### LLM (Required)

Character dialogue is generated in real time by an LLM. At least one profile must be configured.

| Field | Description |
|-------|-------------|
| API Mode | `openai` (OpenAI-compatible, supports proxies and local models) or `anthropic` |
| API Key | Key for the chosen platform |
| Base URL | OpenAI mode only — custom endpoint; leave empty for the official URL |
| Model | e.g. `gpt-4o-mini`, `claude-haiku-4-5-20251001` |
| Persona | Character description passed to the LLM, e.g. `A tsundere cat girl` |

> The LLM response format is `[expression]dialogue`. The app parses this automatically and matches it to a video file. Available expressions are extracted from the character's video filenames.

### TTS (Optional)

When enabled, the LLM-generated dialogue is read aloud.

| Field | Description |
|-------|-------------|
| Enable TTS | Toggle |
| Provider | MiniMax (currently the only supported provider) |
| API Key | MiniMax platform API key |
| Model | e.g. `speech-01` |
| Voice ID | MiniMax voice ID |

### Window

| Field | Description |
|-------|-------------|
| Scale | Adjusts the character window size |
| Opacity | Adjusts overall window transparency |
| Lock | When locked, mouse clicks pass through the window |

### Server (Advanced)

| Field | Default | Description |
|-------|---------|-------------|
| Port | `5287` | Local HTTP service port; must match the plugin config |
| Token | (empty) | When set, the plugin must send the same token or requests are rejected |
| Rate limit window | `60000` ms | Client-side sliding window duration |
| Window limit | `5` | Max events processed per window |

---

## Plugin Config (Optional)

Edit `plugin/config.json` to override default forwarding behavior:

```json
{
  "server_url": "http://localhost:5287",
  "token": "",
  "events": ["PreToolUse", "PostToolUse", "Stop", "Notification", "UserPromptSubmit", "PermissionRequest"],
  "include_content": false
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `server_url` | `http://localhost:5287` | Desktop app address; change for remote deployment |
| `token` | (empty) | Must match the server-side token |
| `events` | All six types | Only forward events in this list |
| `include_content` | `false` | Reserved field |

---

## Development

```bash
cd desktop
npm install
npm run dev        # Dev mode with hot reload
npm run typecheck  # TypeScript type check
npm run build      # Production build
npm run pack       # Package as DMG
```
