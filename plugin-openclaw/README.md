# Aibaji OpenClaw Plugin

将 OpenClaw agent 工作状态实时转发到爱巴基桌面，支持长任务保活心跳与兜底完成检测。

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

## 多实例支持

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

| OpenClaw 事件 | 触发条件 | 发送消息 |
|---|---|---|
| `message:received` | 收到用户消息 | "Your instruction has been received." |
| `message:sent` | Agent 通过 channel 发出回复 | "Task complete." |
| `agent:bootstrap` | Agent 会话启动 | "I'm ready." |
| `command:new` | 用户发送 `/new` 重置会话 | "Starting a new session." |
| `command:reset` | 用户发送 `/reset` 重置会话 | "Starting a new session." |

## 长任务心跳

收到 `message:received` 后，插件会在以下时间点探测当前 session 的执行状态：

**10 秒 → 1 分钟 → 5 分钟 → 10 分钟 → 30 分钟 → 1 小时**

每次探测直接读取 OpenClaw 进程内的队列状态（同进程全局单例，无 IPC 开销）：

- **任务仍在运行** → 发送 `heartbeat` 事件，消息为 `Still working… Xm elapsed.`
- **任务已结束**（lane 空闲，但 `message:sent` 未触发）→ 发送兜底 `message:sent`，消息为 `Task complete.`

收到 `message:sent` 时所有待发心跳立即取消。1 小时为最大检测窗口，之后自动清理 session 状态。

## 限速

普通事件（`message:received`、`message:sent`、`agent:bootstrap`、`command:*`）共享一个滑动窗口限速：**60 秒内最多 5 次**。心跳事件不受此限制（间隔本身已足够稀疏）。
