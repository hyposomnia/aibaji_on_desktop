# Aibaji OpenClaw Plugin

将 OpenClaw agent 工作状态实时转发到爱巴基桌面。

## 安装

一条命令完成安装并自动注册 Hook：

```bash
# agent "main"，使用默认端口 5287
curl -fsSL https://raw.githubusercontent.com/hyposomnia/aibaji_on_desktop/main/plugin-openclaw/install.sh \
  | bash -s -- main

# agent "work"，使用端口 5288
curl -fsSL https://raw.githubusercontent.com/hyposomnia/aibaji_on_desktop/main/plugin-openclaw/install.sh \
  | bash -s -- work 5288
```

命令格式：`bash -s -- <agentId> [port]`

- `agentId`：OpenClaw agent 名称，对应 `~/.openclaw/workspace-<agentId>`
- `port`：爱巴基实例监听端口，默认 `5287`

## 多实例启动

每个爱巴基实例通过独立 `userData` 目录隔离配置：

```bash
# 实例 1（默认，port 5287）
open /Applications/aibaji_desktop.app

# 实例 2（port 5288）
open -n /Applications/aibaji_desktop.app --args \
  --user-data-dir="$HOME/Library/Application Support/aibaji-work"
# 然后在设置中将端口改为 5288
```

## 事件映射

| OpenClaw 事件 | 触发条件 |
|---|---|
| `command:new` | 用户发起新命令 |
| `command:stop` | 会话终止 |
| `message:received` | 收到用户消息 |
| `message:sent` | 响应已发出 |
| `tool_result_persist` | 工具执行后 |
