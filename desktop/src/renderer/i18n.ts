export type Lang = 'en' | 'zh-CN' | 'zh-TW' | 'ja'

const translations = {
  en: {
    // Setup modal
    setupTitle: 'Welcome to Aibaji',
    setupDesc: 'Please select the folder containing character video assets\n(the characters/ directory with character subdirectories)',
    setupSelect: 'Select Folder',
    setupSelecting: 'Selecting...',
    setupError: 'Selection failed, please try again',

    // Settings page
    settingsTitle: 'Aibaji Settings',
    tabCharacter: 'Character',
    tabSystem: 'System',

    // Character tab
    sectionCharacterFolder: 'Character Asset Folder',
    folderNotSelected: 'No folder selected',
    folderChange: 'Change…',
    folderHint: 'Format: {character}/{outfit}/{expression}[number].webm',
    folderExample: 'e.g.: Liuying/Uniform/smile.webm',
    sectionCharacterConfig: 'Character Config',
    noCharacters: 'No characters found. Please select a character asset folder first.',
    outfits: 'Outfits',
    fieldPersona: 'Persona',
    personaPlaceholder: 'A cute anime character',
    fieldLLMModel: 'LLM Model',
    fieldTTSModel: 'TTS Model',
    defaultFirst: 'Default (first)',

    // System tab
    sectionStartup: 'Startup',
    autostartLabel: 'Launch at Login',
    autostartHint: 'Automatically start Aibaji after login',
    sectionWindow: 'Window',
    btnCenterWindow: 'Reset Window Position',
    centerWindowHint: 'Move the character window to the center of the current screen',
    sectionLanguage: 'Language',

    sectionLLM: 'LLM Models',
    fieldName: 'Name',
    modelNamePlaceholder: 'Model name',
    btnDelete: 'Delete',
    fieldAPIType: 'API Type',
    apiOpenAI: 'OpenAI Compatible',
    apiAnthropic: 'Anthropic Compatible',
    fieldAPIKey: 'API Key',
    fieldBaseURL: 'Base URL',
    baseURLPlaceholder: 'Leave empty for official endpoint',
    fieldModel: 'Model',
    btnAddLLM: '+ Add LLM Model',

    sectionTTS: 'TTS Voice Synthesis',
    ttsNamePlaceholder: 'TTS name',
    fieldProvider: 'Provider',
    btnAddTTS: '+ Add TTS Model',

    sectionThrottle: 'Event Throttle',
    fieldTimeWindow: 'Time Window',
    unitMs: 'ms',
    fieldMaxEvents: 'Max Events',
    unitEvents: 'events',
    throttleHint: 'Sliding window rate limit: max events per time window (default 60s / 5).\nPlugin and client use the same strategy.',

    sectionSystemPrompt: 'System Prompt',
    systemPromptHint: 'Supports placeholders: {persona} (character persona), {emotions} (available expression list)',
    btnResetDefault: 'Reset to Default',

    btnSave: 'Save',
    btnSaved: '✓ Saved',

    newModelName: 'New Model',
    newTTSName: 'New TTS',
  },

  'zh-CN': {
    setupTitle: '欢迎使用爱巴基',
    setupDesc: '请选择角色视频素材所在的文件夹\n（包含角色子目录的 characters/ 目录）',
    setupSelect: '选择文件夹',
    setupSelecting: '选择中...',
    setupError: '选择失败，请重试',

    settingsTitle: '爱巴基设置',
    tabCharacter: '角色配置',
    tabSystem: '系统设置',

    sectionCharacterFolder: '角色资源文件夹',
    folderNotSelected: '未选择文件夹',
    folderChange: '更换…',
    folderHint: '文件夹格式：{角色名}/{服装名}/{表情名}[数字].webm',
    folderExample: '例：流萤/制服/微笑.webm',
    sectionCharacterConfig: '角色配置',
    noCharacters: '未扫描到角色，请先选择角色资源文件夹。',
    outfits: '服装',
    fieldPersona: '人设',
    personaPlaceholder: '可爱的二次元角色',
    fieldLLMModel: 'LLM 模型',
    fieldTTSModel: 'TTS 模型',
    defaultFirst: '默认（第一个）',

    sectionStartup: '启动设置',
    autostartLabel: '开机自启动',
    autostartHint: '登录后自动启动爱巴基',
    sectionWindow: '窗口',
    btnCenterWindow: '重置窗口位置',
    centerWindowHint: '将角色窗口移动到当前屏幕正中间',
    sectionLanguage: '语言',

    sectionLLM: 'LLM 模型',
    fieldName: '名称',
    modelNamePlaceholder: '模型名称',
    btnDelete: '删除',
    fieldAPIType: 'API 类型',
    apiOpenAI: 'OpenAI 兼容',
    apiAnthropic: 'Anthropic 兼容',
    fieldAPIKey: 'API Key',
    fieldBaseURL: 'Base URL',
    baseURLPlaceholder: '留空使用官方地址',
    fieldModel: '模型',
    btnAddLLM: '+ 添加 LLM 模型',

    sectionTTS: 'TTS 语音合成',
    ttsNamePlaceholder: 'TTS 名称',
    fieldProvider: '供应商',
    btnAddTTS: '+ 添加 TTS 模型',

    sectionThrottle: '事件节流',
    fieldTimeWindow: '时间窗口',
    unitMs: '毫秒',
    fieldMaxEvents: '最大条数',
    unitEvents: '条',
    throttleHint: '滑动窗口限速：时间窗口内最多处理指定条数（默认 60s / 5条）。\n插件端与客户端同步使用相同策略。',

    sectionSystemPrompt: '系统提示词',
    systemPromptHint: '支持占位符：{persona}（角色人设）、{emotions}（可用表情列表）',
    btnResetDefault: '恢复默认',

    btnSave: '保存',
    btnSaved: '✓ 已保存',

    newModelName: '新模型',
    newTTSName: '新 TTS',
  },

  'zh-TW': {
    setupTitle: '歡迎使用愛巴基',
    setupDesc: '請選擇角色影片素材所在的資料夾\n（包含角色子目錄的 characters/ 目錄）',
    setupSelect: '選擇資料夾',
    setupSelecting: '選擇中...',
    setupError: '選擇失敗，請重試',

    settingsTitle: '愛巴基設定',
    tabCharacter: '角色配置',
    tabSystem: '系統設定',

    sectionCharacterFolder: '角色資源資料夾',
    folderNotSelected: '未選擇資料夾',
    folderChange: '更換…',
    folderHint: '資料夾格式：{角色名}/{服裝名}/{表情名}[數字].webm',
    folderExample: '例：流螢/制服/微笑.webm',
    sectionCharacterConfig: '角色配置',
    noCharacters: '未掃描到角色，請先選擇角色資源資料夾。',
    outfits: '服裝',
    fieldPersona: '人設',
    personaPlaceholder: '可愛的二次元角色',
    fieldLLMModel: 'LLM 模型',
    fieldTTSModel: 'TTS 模型',
    defaultFirst: '預設（第一個）',

    sectionStartup: '啟動設定',
    autostartLabel: '開機自動啟動',
    autostartHint: '登入後自動啟動愛巴基',
    sectionWindow: '視窗',
    btnCenterWindow: '重置視窗位置',
    centerWindowHint: '將角色視窗移動到目前螢幕正中間',
    sectionLanguage: '語言',

    sectionLLM: 'LLM 模型',
    fieldName: '名稱',
    modelNamePlaceholder: '模型名稱',
    btnDelete: '刪除',
    fieldAPIType: 'API 類型',
    apiOpenAI: 'OpenAI 相容',
    apiAnthropic: 'Anthropic 相容',
    fieldAPIKey: 'API Key',
    fieldBaseURL: 'Base URL',
    baseURLPlaceholder: '留空使用官方地址',
    fieldModel: '模型',
    btnAddLLM: '+ 新增 LLM 模型',

    sectionTTS: 'TTS 語音合成',
    ttsNamePlaceholder: 'TTS 名稱',
    fieldProvider: '供應商',
    btnAddTTS: '+ 新增 TTS 模型',

    sectionThrottle: '事件節流',
    fieldTimeWindow: '時間視窗',
    unitMs: '毫秒',
    fieldMaxEvents: '最大條數',
    unitEvents: '條',
    throttleHint: '滑動視窗限速：時間視窗內最多處理指定條數（預設 60s / 5條）。\n插件端與客戶端同步使用相同策略。',

    sectionSystemPrompt: '系統提示詞',
    systemPromptHint: '支援佔位符：{persona}（角色人設）、{emotions}（可用表情列表）',
    btnResetDefault: '恢復預設',

    btnSave: '儲存',
    btnSaved: '✓ 已儲存',

    newModelName: '新模型',
    newTTSName: '新 TTS',
  },

  ja: {
    setupTitle: 'アイバジへようこそ',
    setupDesc: 'キャラクター動画素材のフォルダを選択してください\n（キャラクターサブディレクトリを含む characters/ ディレクトリ）',
    setupSelect: 'フォルダを選択',
    setupSelecting: '選択中...',
    setupError: '選択に失敗しました、もう一度お試しください',

    settingsTitle: 'アイバジ設定',
    tabCharacter: 'キャラクター',
    tabSystem: 'システム設定',

    sectionCharacterFolder: 'キャラクター素材フォルダ',
    folderNotSelected: 'フォルダ未選択',
    folderChange: '変更…',
    folderHint: 'フォルダ形式：{キャラ名}/{衣装名}/{表情名}[番号].webm',
    folderExample: '例：流蛍/制服/微笑み.webm',
    sectionCharacterConfig: 'キャラクター設定',
    noCharacters: 'キャラクターが見つかりません。素材フォルダを先に選択してください。',
    outfits: '衣装',
    fieldPersona: 'ペルソナ',
    personaPlaceholder: 'かわいいアニメキャラクター',
    fieldLLMModel: 'LLM モデル',
    fieldTTSModel: 'TTS モデル',
    defaultFirst: 'デフォルト（最初）',

    sectionStartup: '起動設定',
    autostartLabel: 'ログイン時に起動',
    autostartHint: 'ログイン後に自動的にアイバジを起動',
    sectionWindow: 'ウィンドウ',
    btnCenterWindow: 'ウィンドウ位置をリセット',
    centerWindowHint: 'キャラクターウィンドウを現在の画面中央に移動',
    sectionLanguage: '言語',

    sectionLLM: 'LLM モデル',
    fieldName: '名前',
    modelNamePlaceholder: 'モデル名',
    btnDelete: '削除',
    fieldAPIType: 'API タイプ',
    apiOpenAI: 'OpenAI 互換',
    apiAnthropic: 'Anthropic 互換',
    fieldAPIKey: 'API キー',
    fieldBaseURL: 'ベース URL',
    baseURLPlaceholder: '空白で公式エンドポイントを使用',
    fieldModel: 'モデル',
    btnAddLLM: '+ LLM モデルを追加',

    sectionTTS: 'TTS 音声合成',
    ttsNamePlaceholder: 'TTS 名',
    fieldProvider: 'プロバイダー',
    btnAddTTS: '+ TTS モデルを追加',

    sectionThrottle: 'イベントスロットル',
    fieldTimeWindow: '時間ウィンドウ',
    unitMs: 'ms',
    fieldMaxEvents: '最大件数',
    unitEvents: '件',
    throttleHint: 'スライディングウィンドウレート制限：時間ウィンドウ内の最大処理件数（デフォルト 60s / 5件）。\nプラグインとクライアントは同じ戦略を使用。',

    sectionSystemPrompt: 'システムプロンプト',
    systemPromptHint: 'プレースホルダー対応：{persona}（キャラペルソナ）、{emotions}（利用可能な表情リスト）',
    btnResetDefault: 'デフォルトに戻す',

    btnSave: '保存',
    btnSaved: '✓ 保存済み',

    newModelName: '新しいモデル',
    newTTSName: '新しい TTS',
  },
} as const

export type TranslationKey = keyof typeof translations.en

export function t(lang: Lang, key: TranslationKey): string {
  const map = translations[lang] as Record<string, string>
  return map[key] ?? (translations.en as Record<string, string>)[key] ?? key
}

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
}
