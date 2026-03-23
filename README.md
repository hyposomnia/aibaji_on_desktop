# Aibaji Desktop

Give Claude Code a transparent floating anime companion. While Claude Code is working, the character reacts to its current state — speaking, switching expressions, and playing animations — with optional TTS narration.

[简体中文](README_CN.md) | [繁體中文](README_TW.md) | [日本語](README_JA.md)

---

## How It Works

```
Claude Code triggers a Hook event
  → Plugin forward.sh maps the event to a semantic message, async POSTs to localhost:5287
  → Desktop app receives the message
  → LLM generates [expression] + dialogue
  → Matching transparent webm video plays
  → (Optional) MiniMax TTS reads the dialogue aloud
```

---

## Plugin

The `plugin/` directory is a Claude Code Hook plugin. Once installed, it automatically forwards events to the local desktop app when any of the following fire:

| Event | When it fires | Message sent |
|-------|---------------|--------------|
| `UserPromptSubmit` | User sends a message | `Your instruction has been received.` |
| `PreToolUse` | Before a tool is called | `Prepare to use {tool name}` |
| `PostToolUse` | After a tool completes | `{tool name} finished` |
| `Stop` | Claude Code finishes responding | `Task complete` |
| `Notification` (permission) | Claude Code sends a permission-related notification | `Need your confirmation to {message}` |
| `Notification` (other) | Claude Code sends a regular notification | `{message}` |
| `PermissionRequest` | Tool permission is requested | `Need your authentication to use {tool} ({description})` |

The plugin only forwards semantic summaries — never tool arguments, execution results, or code diffs. Built-in rate limit: 5 events per 60-second sliding window. Always exits `0` — never blocks Claude Code.

---

## Installation

### Step 1: Install the Desktop App

Download the latest `.dmg` from [Releases](../../releases), install, and launch.

Or build from source:

```bash
cd desktop
npm install
npm run pack   # outputs desktop/dist/aibaji_desktop-*.dmg
```

### Step 2: Install the Claude Code Plugin

Inside Claude Code, run these two commands:

```
/plugins marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji_on_desktop
```

No restart required. The plugin takes effect on the next tool call.

### Step 3 (Optional): OpenClaw Plugin

If you use [OpenClaw](https://openclaw.ai), install the hook for a specific agent with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/hyposomnia/aibaji_on_desktop/main/plugin-openclaw/install.sh \
  | bash -s -- <agentId> [port]
```

- `agentId` — your OpenClaw agent name, maps to `~/.openclaw/workspace-<agentId>`
- `port` — port of the Aibaji instance to forward events to (default: `5287`)

The script installs the hook files and automatically runs `openclaw hooks enable aibaji` if `openclaw` is in your PATH.

**Multiple instances:** Each agent can target a separate Aibaji instance on a different port. Launch additional instances with a different `--user-data-dir`:

```bash
open -n /Applications/aibaji_desktop.app --args \
  --user-data-dir="$HOME/Library/Application Support/aibaji-work"
# Then change the port to 5288 in Settings
```

---

## Character Video Assets

The desktop app requires a set of `.webm` video files with an alpha channel as character assets.

Demo assets are available here: [aibaji_on_desktop_resources](https://github.com/hyposomnia/aibaji_on_desktop_resources)

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
| Name | Label for this config, for managing multiple profiles |

> The LLM response format is `[expression]dialogue`. The app parses this automatically and matches it to a video file. Available expressions are extracted from the character's video filenames.

### TTS (Optional)

When enabled, the LLM-generated dialogue is read aloud.

| Field | Description |
|-------|-------------|
| Name | Label for this config |
| Provider | MiniMax (currently the only supported provider) |
| API Key | MiniMax platform API key |
| Model | e.g. `speech-01` |
| Voice ID | MiniMax voice ID |

### Character Config

| Field | Description |
|-------|-------------|
| Persona | Character description passed to the LLM, e.g. `A tsundere cat girl` |
| LLM Model | Which LLM profile to use for this character (defaults to the first) |
| TTS Model | Which TTS profile to use for this character (defaults to the first) |

### Window

| Field | Description |
|-------|-------------|
| Scale | Adjusts the character window size |
| Opacity | Adjusts overall window transparency |
| Lock | When locked, mouse clicks pass through the window — ideal for focused work |
| Reset Window Position | Moves the character window to the center of the current screen (useful after display resolution changes) |

**Gestures**

- **Drag**: Hold left mouse button anywhere on the character window and drag to reposition it freely
- **Double-click**: When not locked, double-click the character to randomly switch to another outfit

### Server (Advanced)

| Field | Default | Description |
|-------|---------|-------------|
| Token | (empty) | When set, the plugin must send the same token or requests are rejected; set the same value in `plugin/config.json` |
| Rate limit window | `60000` ms | Sliding window duration |
| Window limit | `5` | Max events processed per window |

---

## Plugin Config (Optional)

Edit `plugin/config.json` to override default forwarding behavior:

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

| Field | Default | Description |
|-------|---------|-------------|
| `server_url` | `http://localhost:5287` | Desktop app address; change for remote deployment |
| `token` | (empty) | Must match the server-side token |
| `events` | All seven types | Only forward events in this list |
| `messages` | See above | Message templates per event; supports `{tool}` and `{msg}` placeholders |
| `notification_permission_keywords` | See above | Keywords used to classify a notification as permission-related |
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
