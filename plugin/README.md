# 爱巴基桌面版 - Claude Code Hook 插件

将 Claude Code 的工作状态实时发送到爱巴基桌面伴侣应用。

## 安装

在 Claude Code 中依次执行：

```
/plugins marketplace add hyposomnia/aibaji_on_desktop
/plugins add aibaji@aibaji_on_desktop
```

安装完成后插件自动注册所有 Hook，无需重启，下一次工具调用即生效。

## 监听的事件

| 事件 | 触发时机 | 转发内容 |
|------|----------|----------|
| `UserPromptSubmit` | 用户发送消息时 | 用户原文（代码块替换为占位符） |
| `PreToolUse` | 工具调用前 | 工具名称 |
| `PostToolUse` | 工具调用后 | 工具名称 |
| `Stop` | 回复结束时 | 固定映射为"任务已完成" |
| `Notification` | Claude Code 发出通知时 | 通知文本；权限/授权类自动标注为"需要用户操作" |
| `PermissionRequest` | 请求工具权限时 | 固定映射为"需要用户授权：{工具名}" |

插件只转发语义摘要，不会转发工具参数、执行结果、代码 diff 等大体积内容。

## 限速

插件内置滑动窗口限速：60 秒内最多转发 5 次，超出的事件静默丢弃，不影响 Claude Code 正常运行。

## 配置（可选）

编辑 `config.json` 可覆盖默认行为：

```json
{
  "server_url": "http://localhost:5287",
  "token": "",
  "events": ["PreToolUse", "PostToolUse", "Stop", "Notification", "UserPromptSubmit", "PermissionRequest"],
  "include_content": false
}
```

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `server_url` | 桌面应用地址 | `http://localhost:5287` |
| `token` | Bearer Token 认证，与桌面应用服务端保持一致 | `""` |
| `events` | 要监听的事件类型 | 全部六类 |
| `include_content` | 预留字段 | `false` |

也可通过环境变量配置（优先级低于 config.json）：

- `AIBAJI_SERVER_URL`：服务器地址
- `AIBAJI_TOKEN`：认证 Token

## 依赖

- `curl`（系统内置）
- `jq`（推荐安装；用于解析 config.json 和精简事件数据；未安装时 fallback 到环境变量）

## 测试

确保桌面应用正在运行，然后执行：

```bash
echo '{"hook_event_name":"Stop","session_id":"test"}' | \
  CLAUDE_PLUGIN_ROOT="$(pwd)" bash hooks/forward.sh
curl http://localhost:5287/health
```
