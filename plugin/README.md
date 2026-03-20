# 爱巴基桌面版 - Claude Code Hook 插件

将 Claude Code 的工作状态实时发送到爱巴基桌面伴侣应用。

## 安装

在 Claude Code 中依次执行：

```
/plugins marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji_on_desktop
```

安装完成后插件自动注册所有 Hook，无需重启，下一次工具调用即生效。

## 消息格式

插件在发送前完成全部语义映射，向桌面应用发送精简 JSON：

```json
{ "event": "PreToolUse", "message": "Prepare to use Bash" }
```

各事件的默认映射规则：

| 事件 | 触发时机 | 发送的 `message` |
|------|----------|-----------------|
| `UserPromptSubmit` | 用户发送消息时 | `Your instruction has been received.` |
| `PreToolUse` | 工具调用前 | `Prepare to use {工具名}` |
| `PostToolUse` | 工具调用后 | `{工具名} finished` |
| `Stop` | 回复结束时 | `Task complete` |
| `Notification`（权限类） | Claude Code 发出权限相关通知时 | `Need your confirmation to {通知内容}` |
| `Notification`（其他） | Claude Code 发出普通通知时 | `{通知内容}` |
| `PermissionRequest` | 请求工具权限时 | `Need your authentication to use {工具名} ({说明})` |

插件不会转发工具参数、执行结果、代码 diff 等大体积内容。

## 限速

插件内置滑动窗口限速：60 秒内最多转发 5 次，超出的事件静默丢弃，不影响 Claude Code 正常运行。

## 配置（可选）

编辑 `config.json` 可覆盖默认行为：

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

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `server_url` | 桌面应用地址 | `http://localhost:5287` |
| `token` | Bearer Token 认证，与桌面应用服务端保持一致 | `""` |
| `events` | 要监听的事件类型 | 全部六类 |
| `messages` | 各事件的消息模板，支持 `{tool}`、`{msg}` 占位符 | 见上方默认值 |
| `notification_permission_keywords` | 用于识别权限类通知的关键词列表 | 见上方默认值 |
| `include_content` | 预留字段 | `false` |

也可通过环境变量配置（优先级低于 config.json）：

- `AIBAJI_SERVER_URL`：服务器地址
- `AIBAJI_TOKEN`：认证 Token

## 依赖

- `curl`（系统内置）
- `jq`（推荐安装；用于解析配置和构建 JSON；未安装时使用内置默认值和简单字符串拼接）

## 测试

确保桌面应用正在运行，然后执行：

```bash
echo '{"hook_event_name":"Stop","session_id":"test"}' | \
  CLAUDE_PLUGIN_ROOT="$(pwd)" bash hooks/forward.sh
curl http://localhost:5287/health
```
