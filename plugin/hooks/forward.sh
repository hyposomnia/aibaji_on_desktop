#!/usr/bin/env bash
# 爱巴基桌面版 - Hook 转发脚本
# 将 Claude Code 工作事件异步发送到本地 Electron 应用

set -euo pipefail

# 读取事件数据（从 stdin）
EVENT_DATA=$(cat)

# 插件端限速：10 秒内最多发送一次（flock 保证并发安全）
RATE_LIMIT_FILE="/tmp/aibaji_last_send"
RATE_LIMIT_INTERVAL=10
SHOULD_SEND=0
{
  flock 9
  NOW=$(date +%s)
  LAST=$(cat "$RATE_LIMIT_FILE" 2>/dev/null || echo 0)
  if [ $((NOW - LAST)) -ge $RATE_LIMIT_INTERVAL ]; then
    echo "$NOW" > "$RATE_LIMIT_FILE"
    SHOULD_SEND=1
  fi
} 9>"${RATE_LIMIT_FILE}.lock"
if [ "$SHOULD_SEND" -eq 0 ]; then
  exit 0
fi

# 配置文件路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config.json"

# 读取配置（优先 config.json，fallback 到环境变量）
if command -v jq &>/dev/null && [ -f "$CONFIG_FILE" ]; then
  SERVER_URL=$(jq -r '.server_url // "http://localhost:5287"' "$CONFIG_FILE")
  TOKEN=$(jq -r '.token // ""' "$CONFIG_FILE")
else
  SERVER_URL="${AIBAJI_SERVER_URL:-http://localhost:5287}"
  TOKEN="${AIBAJI_TOKEN:-}"
fi

# 构建 curl 参数
CURL_ARGS=(
  -s
  -X POST
  "${SERVER_URL}/event"
  -H "Content-Type: application/json"
  --max-time 2
  -d "$EVENT_DATA"
)

# 添加可选的 Bearer Token 认证
if [ -n "$TOKEN" ]; then
  CURL_ARGS+=(-H "Authorization: Bearer ${TOKEN}")
fi

# 异步后台发送，不影响 Claude Code 主流程
(curl "${CURL_ARGS[@]}" &>/dev/null) &
disown

exit 0
