#!/usr/bin/env bash
# 爱巴基桌面版 - Hook 转发脚本
# 将 Claude Code 工作事件语义化后异步发送到本地 Electron 应用

set -euo pipefail

# 读取事件数据（从 stdin）
EVENT_DATA=$(cat)

# 插件端限速：60 秒滑动窗口内最多发送 5 次（mkdir 原子锁，兼容 macOS/Linux）
RATE_LOG="/tmp/aibaji_send_log"
LOCK_DIR="/tmp/aibaji_send_log.lock"
WINDOW_SECONDS=60
WINDOW_LIMIT=5
SHOULD_SEND=0

# 获取锁（自旋等待，最多 1 秒）
LOCK_ATTEMPTS=0
until mkdir "$LOCK_DIR" 2>/dev/null; do
  LOCK_ATTEMPTS=$((LOCK_ATTEMPTS + 1))
  if [ "$LOCK_ATTEMPTS" -ge 20 ]; then
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
  sleep 0.05
done
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

NOW=$(date +%s)
CUTOFF=$((NOW - WINDOW_SECONDS))
if [ -f "$RATE_LOG" ]; then
  RECENT=$(awk -v cutoff="$CUTOFF" '$1 > cutoff {print}' "$RATE_LOG")
else
  RECENT=""
fi
COUNT=0
if [ -n "$RECENT" ]; then
  COUNT=$(echo "$RECENT" | wc -l | tr -d ' ')
fi
if [ "$COUNT" -lt "$WINDOW_LIMIT" ]; then
  { [ -n "$RECENT" ] && echo "$RECENT"; echo "$NOW"; } > "$RATE_LOG"
  SHOULD_SEND=1
fi

rmdir "$LOCK_DIR" 2>/dev/null || true
trap - EXIT

if [ "$SHOULD_SEND" -eq 0 ]; then
  exit 0
fi

# 配置文件路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config.json"

# 读取服务器配置
if command -v jq &>/dev/null && [ -f "$CONFIG_FILE" ]; then
  SERVER_URL=$(jq -r '.server_url // "http://localhost:5287"' "$CONFIG_FILE")
  TOKEN=$(jq -r '.token // ""' "$CONFIG_FILE")
else
  SERVER_URL="${AIBAJI_SERVER_URL:-http://localhost:5287}"
  TOKEN="${AIBAJI_TOKEN:-}"
fi

# 提取事件类型
EVENT_NAME=$(echo "$EVENT_DATA" | jq -r '.hook_event_name // "unknown"' 2>/dev/null || echo "unknown")

# 检查事件是否在允许列表中（需要 jq）
if command -v jq &>/dev/null && [ -f "$CONFIG_FILE" ]; then
  ALLOWED=$(jq -r --arg e "$EVENT_NAME" '(.events // []) | map(select(. == $e)) | length' "$CONFIG_FILE")
  if [ "$ALLOWED" -eq 0 ]; then
    exit 0
  fi
fi

# 读取消息模板（有 jq + config 则用配置，否则用内置默认值）
if command -v jq &>/dev/null && [ -f "$CONFIG_FILE" ]; then
  TPL_PRE=$(jq -r '.messages.PreToolUse        // "Prepare to use {tool}"'                          "$CONFIG_FILE")
  TPL_POST=$(jq -r '.messages.PostToolUse       // "{tool} finished"'                               "$CONFIG_FILE")
  TPL_STOP=$(jq -r '.messages.Stop              // "Task complete"'                                 "$CONFIG_FILE")
  TPL_NOTIF=$(jq -r '.messages.Notification     // "{msg}"'                                         "$CONFIG_FILE")
  TPL_NOTIF_PERM=$(jq -r '.messages.NotificationPermission // "Need your confirmation to {msg}"'   "$CONFIG_FILE")
  TPL_PERM=$(jq -r '.messages.PermissionRequest // "Need your authentication to use {tool} ({msg})"' "$CONFIG_FILE")
  TPL_USER=$(jq -r '.messages.UserPromptSubmit  // "Your instruction has been received."'           "$CONFIG_FILE")
  PERM_KEYWORDS=$(jq -r '(.notification_permission_keywords // ["permission","allow","deny","approv","confirm","authoriz"]) | join("|")' "$CONFIG_FILE")
else
  TPL_PRE="Prepare to use {tool}"
  TPL_POST="{tool} finished"
  TPL_STOP="Task complete"
  TPL_NOTIF="{msg}"
  TPL_NOTIF_PERM="Need your confirmation to {msg}"
  TPL_PERM="Need your authentication to use {tool} ({msg})"
  TPL_USER="Your instruction has been received."
  PERM_KEYWORDS="permission|allow|deny|approv|confirm|authoriz"
fi

# 按事件类型做语义映射，产出 MESSAGE
case "$EVENT_NAME" in
  PreToolUse)
    TOOL=$(echo "$EVENT_DATA" | jq -r '.tool_name // ""')
    MESSAGE="${TPL_PRE//\{tool\}/$TOOL}"
    ;;

  PostToolUse)
    TOOL=$(echo "$EVENT_DATA" | jq -r '.tool_name // ""')
    MESSAGE="${TPL_POST//\{tool\}/$TOOL}"
    ;;

  Stop)
    MESSAGE="$TPL_STOP"
    ;;

  Notification)
    MSG=$(echo "$EVENT_DATA" | jq -r '.message // ""')
    NOTIF_TYPE=$(echo "$EVENT_DATA" | jq -r '.notification_type // ""')
    COMBINED=$(printf '%s %s' "$NOTIF_TYPE" "$MSG" | tr '[:upper:]' '[:lower:]')
    if echo "$COMBINED" | grep -qE "$PERM_KEYWORDS"; then
      MESSAGE="${TPL_NOTIF_PERM//\{msg\}/$MSG}"
    else
      MESSAGE="${TPL_NOTIF//\{msg\}/$MSG}"
    fi
    ;;

  PermissionRequest)
    TOOL=$(echo "$EVENT_DATA" | jq -r '.tool_name // .tool // ""')
    MSG=$(echo "$EVENT_DATA" | jq -r '.message // ""')
    MESSAGE="${TPL_PERM//\{tool\}/$TOOL}"
    MESSAGE="${MESSAGE//\{msg\}/$MSG}"
    ;;

  UserPromptSubmit)
    MESSAGE="$TPL_USER"
    ;;

  *)
    exit 0
    ;;
esac

# 构建精简 JSON payload：只含事件类型和已映射的消息
if command -v jq &>/dev/null; then
  SEND_DATA=$(jq -n --arg event "$EVENT_NAME" --arg message "$MESSAGE" \
    '{event: $event, message: $message}')
else
  # jq 不可用时回退到手动拼接（消息中不含引号/特殊字符时安全）
  SEND_DATA="{\"event\":\"${EVENT_NAME}\",\"message\":\"${MESSAGE}\"}"
fi

# 构建 curl 参数
CURL_ARGS=(
  -s
  -X POST
  "${SERVER_URL}/event"
  -H "Content-Type: application/json"
  --max-time 2
  -d "$SEND_DATA"
)

if [ -n "$TOKEN" ]; then
  CURL_ARGS+=(-H "Authorization: Bearer ${TOKEN}")
fi

# 异步后台发送，不影响 Claude Code 主流程
(curl "${CURL_ARGS[@]}" &>/dev/null) &
disown

exit 0
