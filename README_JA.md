# アイバジ デスクトップ

Claude Code に透明フローティングのアニメキャラクターを追加します。Claude Code が作業中、キャラクターは現在の状態に応じてセリフを話し、表情を切り替え、アニメーションを再生します。TTS 読み上げはオプションで有効化できます。

[English](README.md) | [简体中文](README_CN.md) | [繁體中文](README_TW.md)

---

## 仕組み

```
Claude Code が Hook イベントを発火
  → プラグイン forward.sh がイベントをセマンティックメッセージにマッピングし、localhost:5287 へ非同期 POST
  → デスクトップアプリがメッセージを受信
  → LLM が [表情] + セリフを生成
  → 対応する透明 webm 動画を再生
  → （オプション）MiniMax TTS がセリフを読み上げ
```

---

## プラグイン

`plugin/` ディレクトリは Claude Code Hook プラグインです。インストール後、以下の 7 種類のイベント発火時に自動でローカルのデスクトップアプリへ転送します：

| イベント | 発火タイミング | 送信されるメッセージ |
|---------|--------------|-------------------|
| `UserPromptSubmit` | ユーザーがメッセージを送信したとき | `Your instruction has been received.` |
| `PreToolUse` | ツール呼び出し前 | `Prepare to use {ツール名}` |
| `PostToolUse` | ツール呼び出し後 | `{ツール名} finished` |
| `Stop` | 返答終了時 | `Task complete` |
| `Notification`（権限系） | Claude Code が権限関連の通知を出したとき | `Need your confirmation to {通知内容}` |
| `Notification`（その他） | Claude Code が通常の通知を出したとき | `{通知内容}` |
| `PermissionRequest` | ツール権限を要求したとき | `Need your authentication to use {ツール名} ({説明})` |

プラグインはセマンティックサマリーのみを転送します。ツール引数・実行結果・コード diff などの大容量コンテンツは転送しません。内蔵レート制限：60 秒スライディングウィンドウで最大 5 件。常に `exit 0` で Claude Code をブロックしません。

---

## インストール

### ステップ 1：デスクトップアプリをインストール

[Releases](../../releases) から最新の `.dmg` をダウンロードして、インストール・起動します。

またはソースからビルド：

```bash
cd desktop
npm install
npm run pack   # desktop/dist/aibaji_desktop-*.dmg を出力
```

### ステップ 2：Claude Code プラグインをインストール

Claude Code 内で以下の 2 つのコマンドを実行：

```
/plugins marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji_on_desktop
```

再起動不要。次のツール呼び出しからイベントの転送が始まります。

### ステップ 3（オプション）：OpenClaw プラグイン

[OpenClaw](https://openclaw.ai) を使用している場合、1 つのコマンドで指定した agent に hook をインストールできます：

```bash
curl -fsSL https://raw.githubusercontent.com/hyposomnia/aibaji_on_desktop/main/plugin-openclaw/install.sh \
  | bash -s -- <agentId> [port]
```

- `agentId` — OpenClaw の agent 名。`~/.openclaw/workspace-<agentId>` に対応します
- `port` — 転送先の Aibaji インスタンスのポート（デフォルト：`5287`）

スクリプトが hook ファイルをインストールし、`openclaw` が PATH にあれば `openclaw hooks enable aibaji` を自動実行します。

**マルチインスタンス：** 各 agent を別々の Aibaji インスタンス・ポートに対応させることができます。異なる `--user-data-dir` で追加インスタンスを起動します：

```bash
open -n /Applications/aibaji_desktop.app --args \
  --user-data-dir="$HOME/Library/Application Support/aibaji-work"
# その後、設定でポートを 5288 に変更
```

---

## キャラクター動画素材の準備

デスクトップアプリはアルファチャンネル付きの `.webm` 動画ファイルをキャラクター素材として使用します。

デモ素材は以下のリポジトリからダウンロードできます：[aibaji_on_desktop_resources](https://github.com/hyposomnia/aibaji_on_desktop_resources)

### ディレクトリ構成

```
characters/
└── キャラ名/
    └── 衣装名/
        ├── 平静1.1.webm
        ├── 平静1.2.webm
        ├── 微笑み.webm
        ├── 嬉しい.webm
        ├── 驚き.webm
        └── 怒り.webm
```

### ファイル要件

- 形式：`.webm`、VP9 コーデック、**アルファチャンネル必須**（透明背景）
- ファイル名（拡張子と末尾の数字を除いた部分）が表情名になります
  - 例：`平静1.1.webm`、`平静1.2.webm` → 表情名はいずれも `平静1`
- 表情名が `平静` で始まる動画はアイドル calm プールに、それ以外は other プールに入り、アイドル時に各 50% の確率でランダム再生されます

### 素材パスの設定

初回起動時にフォルダ選択ダイアログが表示されます。キャラクターサブディレクトリを含む `characters/` ルートディレクトリを選択してください。設定は後から 設定 → キャラクタータブ で変更できます。

---

## 設定

初回起動後、システムトレイアイコンをクリックして **設定** を開きます。

設定ファイルの場所：`~/Library/Application Support/aibaji-desktop/config.json`

### LLM 設定（必須）

キャラクターのセリフは LLM がリアルタイムで生成します。少なくとも 1 つのプロファイルを設定する必要があります。

| 項目 | 説明 |
|------|------|
| API モード | `openai`（OpenAI 互換、プロキシやローカルモデルに対応）または `anthropic` |
| API Key | 対応プラットフォームの API Key |
| Base URL | `openai` モードのみ。カスタムエンドポイント。空白で公式 URL を使用 |
| モデル | 例：`gpt-4o-mini`、`claude-haiku-4-5-20251001` |
| 名前 | この設定の識別ラベル（複数設定の管理用） |

> LLM の返答形式は `[表情名]セリフ内容` です。アプリが自動解析して動画ファイルをマッチングします。利用可能な表情はキャラクターの動画ファイル名から自動抽出されます。

### TTS 設定（オプション）

有効にすると、LLM が生成したセリフを音声で読み上げます。

| 項目 | 説明 |
|------|------|
| 名前 | この設定の識別ラベル |
| プロバイダー | 現在は MiniMax のみ対応 |
| API Key | MiniMax プラットフォームの API Key |
| モデル | 例：`speech-01` |
| Voice ID | MiniMax のボイス ID |

### キャラクター設定

| 項目 | 説明 |
|------|------|
| ペルソナ | LLM に渡すキャラクターの説明（例：`ツンデレな猫耳少女`） |
| LLM モデル | このキャラクターに使用する LLM 設定（デフォルトは最初の設定） |
| TTS モデル | このキャラクターに使用する TTS 設定（デフォルトは最初の設定） |

### ウィンドウ設定

| 項目 | 説明 |
|------|------|
| スケール | キャラクターウィンドウのサイズを調整 |
| 透明度 | ウィンドウ全体の透明度を調整 |
| ロック | ロック時はマウスクリックがウィンドウを透過 — 集中作業時に便利 |
| ウィンドウ位置をリセット | キャラクターウィンドウを現在の画面中央に移動（ディスプレイ切替や解像度変更後にウィンドウを見失ったときに使用） |

**ジェスチャー**

- **ドラッグ**：キャラクターウィンドウの任意の場所でマウス左ボタンを押したままドラッグして、自由に移動できます
- **ダブルクリック**：ロックされていない状態でキャラクターをダブルクリックすると、ランダムで別の衣装に切り替わります

### サーバー設定（上級）

| 項目 | デフォルト | 説明 |
|------|-----------|------|
| Token | 空白 | 設定した場合、プラグインが同じ Token を送信しないとリクエストが拒否されます。`plugin/config.json` の `token` フィールドと一致させてください |
| レート制限ウィンドウ | `60000` ms | スライディングウィンドウの時間幅 |
| ウィンドウ内上限 | `5` | ウィンドウ内で処理するイベントの最大件数 |

---

## プラグイン設定（オプション）

`plugin/config.json` を編集してデフォルトの転送動作を変更できます：

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

| フィールド | デフォルト | 説明 |
|-----------|-----------|------|
| `server_url` | `http://localhost:5287` | デスクトップアプリのアドレス。リモートデプロイ時に変更 |
| `token` | 空白 | サーバー側の Token と一致させてください |
| `events` | 全 7 種 | このリスト内のイベントのみ転送 |
| `messages` | 上記参照 | 各イベントのメッセージテンプレート。`{tool}`、`{msg}` プレースホルダーに対応 |
| `notification_permission_keywords` | 上記参照 | 通知を権限関連として分類するキーワード一覧 |
| `include_content` | `false` | 予約フィールド |

---

## 開発

```bash
cd desktop
npm install
npm run dev        # 開発モード（ホットリロード）
npm run typecheck  # TypeScript 型チェック
npm run build      # プロダクションビルド
npm run pack       # DMG としてパッケージ化
```
