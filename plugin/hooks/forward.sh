#!/usr/bin/env bash
# 爱巴基桌面版 - Hook 转发脚本
# 将 Claude Code 工作事件异步发送到本地 Electron 应用

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
    # 超时则强制删除旧锁继续
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
  sleep 0.05
done
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

NOW=$(date +%s)
CUTOFF=$((NOW - WINDOW_SECONDS))
# 过滤窗口内的时间戳并计数
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
  # 写回过滤后的记录 + 新时间戳
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
