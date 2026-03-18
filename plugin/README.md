# 爱巴基桌面版 - Claude Code Hook 插件

将 Claude Code 的工作状态实时发送到爱巴基桌面伴侣应用。

## 安装（一键安装）

**第一步：** 在 `~/.claude/settings.json` 中注册插件源（只需一次）：

```json
{
  "extraKnownMarketplaces": {
    "aibaji": {
      "source": {
        "source": "github",
        "repo": "hyposomnia/aibaji_on_desktop"
      }
    }
  }
}
```

**第二步：** 在 Claude Code 中执行：

```
/plugins add aibaji@aibaji
```

安装完成后插件会自动注册所有 Hook，无需手动配置。

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
