# 愛巴基桌面版

讓 Claude Code 擁有一個透明懸浮的二次元角色夥伴。Claude Code 工作時，角色會根據當前狀態說話、切換表情、播放動畫，可選 TTS 朗讀台詞。

[English](README.md) | [简体中文](README_CN.md) | [日本語](README_JA.md)

---

## 工作原理

```
Claude Code 觸發 Hook 事件
  → 插件 forward.sh 將事件映射為語義訊息，非同步 POST 到 localhost:5287
  → 桌面應用接收訊息
  → 呼叫 LLM 產生 [表情] + 台詞
  → 播放對應表情的透明 webm 影片
  → （可選）MiniMax TTS 朗讀台詞
```

---

## 插件說明

`plugin/` 目錄是一個 Claude Code Hook 插件，安裝後會在以下七類事件觸發時自動將事件轉發到本地桌面應用：

| 事件 | 觸發時機 | 發送的訊息 |
|------|----------|------------|
| `UserPromptSubmit` | 使用者發送訊息時 | `Your instruction has been received.` |
| `PreToolUse` | 工具呼叫前 | `Prepare to use {工具名}` |
| `PostToolUse` | 工具呼叫後 | `{工具名} finished` |
| `Stop` | 回覆結束時 | `Task complete` |
| `Notification`（權限類） | Claude Code 發出權限相關通知時 | `Need your confirmation to {通知內容}` |
| `Notification`（其他） | Claude Code 發出一般通知時 | `{通知內容}` |
| `PermissionRequest` | 請求工具權限時 | `Need your authentication to use {工具名} ({說明})` |

插件只轉發語義摘要，不會轉發工具參數、執行結果、程式碼 diff 等大體積內容。內建限速：60 秒滑動視窗內最多轉發 5 次。始終 `exit 0`，不阻塞 Claude Code。

---

## 安裝

### 第一步：安裝桌面應用

從 [Releases](../../releases) 下載最新的 `.dmg`，安裝並啟動。

或從原始碼建置：

```bash
cd desktop
npm install
npm run pack   # 輸出 desktop/dist/aibaji_desktop-*.dmg
```

### 第二步：安裝 Claude Code 插件

在 Claude Code 中依次執行：

```
/plugins marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji_on_desktop
```

安裝完成後無需重啟，下一次工具呼叫即開始轉發事件。

---

## 準備角色影片資源

桌面應用需要一組帶透明通道的 `.webm` 影片檔案作為角色素材。

示範資源可從以下倉庫下載：[aibaji_on_desktop_resources](https://github.com/hyposomnia/aibaji_on_desktop_resources)

### 目錄結構

```
characters/
└── 角色名/
    └── 服裝名/
        ├── 平靜1.1.webm
        ├── 平靜1.2.webm
        ├── 微笑.webm
        ├── 開心.webm
        ├── 驚訝.webm
        └── 生氣.webm
```

### 檔案要求

- 格式：`.webm`，VP9 編碼，**必須帶 Alpha 通道**（透明背景）
- 檔名即表情名，末尾數字為同表情多版本編號（播放時隨機選取）
  - 例：`平靜1.1.webm`、`平靜1.2.webm` → 表情名均為 `平靜1`
- 表情名以 `平静` 開頭的影片歸入空閒動畫池（calm pool），其餘歸入 other pool，空閒時各以 50% 機率隨機播放

### 資源路徑

首次啟動桌面應用時會彈出資料夾選擇視窗，選擇包含角色子目錄的 `characters/` 根目錄即可。之後可在設定頁 → 角色選項卡中修改。

---

## 設定參數

首次啟動後點擊系統托盤圖示，進入「設定」頁面完成以下設定。

設定檔儲存於：`~/Library/Application Support/aibaji-desktop/config.json`

### LLM 設定（必填）

角色台詞由 LLM 即時產生，必須設定一個可用的 LLM。

| 參數 | 說明 |
|------|------|
| API 模式 | `openai`（相容 OpenAI 格式，支援代理/國產模型）或 `anthropic` |
| API Key | 對應平台的 API Key |
| Base URL | 僅 `openai` 模式需要，填寫 API 端點地址；留空則使用官方地址 |
| 模型 | 例：`gpt-4o-mini`、`claude-haiku-4-5-20251001` |
| 名稱 | 設定的名稱標識，便於管理多個設定 |

> LLM 的回覆格式要求為 `[表情名]台詞內容`，應用會自動解析並匹配影片。可用表情由當前角色的影片檔名自動提取。

### TTS 設定（可選）

啟用後會將 LLM 產生的台詞透過語音播放出來。

| 參數 | 說明 |
|------|------|
| 名稱 | 設定的名稱標識 |
| 供應商 | 目前僅支援 MiniMax |
| API Key | MiniMax 平台 API Key |
| 模型 | 例：`speech-01` |
| Voice ID | MiniMax 音色 ID |

### 角色設定

| 參數 | 說明 |
|------|------|
| 人設 | 傳給 LLM 的角色描述，例：`傲嬌的貓娘` |
| LLM 模型 | 為該角色指定使用哪套 LLM 設定（預設用第一個） |
| TTS 模型 | 為該角色指定使用哪套 TTS 設定（預設用第一個） |

### 視窗設定

| 參數 | 說明 |
|------|------|
| 縮放比例 | 調整角色視窗大小 |
| 透明度 | 調整視窗整體透明度 |
| 鎖定 | 鎖定後滑鼠點擊穿透視窗，適合專注工作時使用 |
| 重置視窗位置 | 將視窗移動到當前光標所在螢幕的正中間（切換顯示器或解析度變化後找回視窗） |

**互動手勢**

- **拖曳**：在角色視窗任意位置按住滑鼠左鍵拖動，可自由移動視窗位置
- **雙擊**：非鎖定狀態下雙擊角色，隨機切換為當前角色的其他服裝

### 伺服器設定（進階）

| 參數 | 預設值 | 說明 |
|------|--------|------|
| Token | 空 | 啟用後插件須攜帶相同 Token，否則請求被拒絕；插件 `config.json` 中的 `token` 欄位需與此保持一致 |
| 限速視窗 | `60000` ms | 客戶端限速時間視窗 |
| 視窗內上限 | `5` | 時間視窗內最多處理的事件數 |

---

## 插件設定（可選）

插件目錄下的 `plugin/config.json` 可覆蓋預設轉發行為：

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

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `server_url` | `http://localhost:5287` | 桌面應用地址，遠端部署時修改 |
| `token` | 空 | 與桌面應用伺服器端 Token 保持一致 |
| `events` | 全部七類 | 只轉發列表中的事件類型 |
| `messages` | 見上方 | 各事件的訊息模板，支援 `{tool}`、`{msg}` 佔位符 |
| `notification_permission_keywords` | 見上方 | 識別權限類通知的關鍵詞列表 |
| `include_content` | `false` | 預留欄位 |

---

## 開發

```bash
cd desktop
npm install
npm run dev        # 開發模式（熱重載）
npm run typecheck  # TypeScript 型別檢查
npm run build      # 生產建置
npm run pack       # 打包為 DMG
```
