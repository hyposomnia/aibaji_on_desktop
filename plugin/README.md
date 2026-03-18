# 爱巴基桌面版 - Claude Code Hook 插件

将 Claude Code 的工作状态实时发送到爱巴基桌面伴侣应用。

## 安装

1. 打开 Claude Code 设置（`~/.claude/settings.json`）
2. 在 `plugins` 数组中添加本插件路径：

```json
{
  "plugins": ["/path/to/aibaji_on_desktop/plugin"]
}
```

或者手动将 hooks 配置到 `~/.claude/settings.json` 的 `hooks` 字段：

```json
{
  "hooks": {
    "PreToolUse":       [{"matcher": "", "hooks": [{"type": "command", "command": "bash /path/to/plugin/hooks/forward.sh"}]}],
    "PostToolUse":      [{"matcher": "", "hooks": [{"type": "command", "command": "bash /path/to/plugin/hooks/forward.sh"}]}],
    "Stop":             [{"matcher": "", "hooks": [{"type": "command", "command": "bash /path/to/plugin/hooks/forward.sh"}]}],
    "Notification":     [{"matcher": "", "hooks": [{"type": "command", "command": "bash /path/to/plugin/hooks/forward.sh"}]}],
    "UserPromptSubmit": [{"matcher": "", "hooks": [{"type": "command", "command": "bash /path/to/plugin/hooks/forward.sh"}]}]
  }
}
```

## 配置

编辑 `config.json`：

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `server_url` | 桌面应用 HTTP 服务地址 | `http://localhost:5287` |
| `token` | 可选的 Bearer Token 认证 | `""` |
| `events` | 监听的事件类型列表 | 所有事件 |
| `include_content` | 是否包含完整内容（预留字段） | `false` |

也可通过环境变量配置：
- `AIBAJI_SERVER_URL`：服务器地址
- `AIBAJI_TOKEN`：认证 Token

## 测试

确保桌面应用正在运行后，执行：

```bash
echo '{"hook_event_name":"Stop","session_id":"test"}' | bash plugin/hooks/forward.sh
curl http://localhost:5287/health
```

## 要求

- `curl`（系统内置）
- `jq`（可选，用于解析 config.json；未安装时使用环境变量）
