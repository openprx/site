---
title: Webhook 调度器
description: "Sylvode Webhook：接收 Sylvode 事件并派发 AI 编码代理的 Rust 服务。"
sidebar:
  order: 2
---

Sylvode Webhook 是一个基于 Axum 构建的 Rust 服务，将 Sylvode 的项目管理事件与 AI 编码代理桥接起来。它接收 Webhook 事件，验证其真实性，并启动相应的代理来处理任务。

## 架构

```
Sylvode ──webhook──▶ Sylvode Webhook ──CLI──▶ AI 代理
                         │                      │
                         │◀─────callback─────────┘
                         │
                    WSS 隧道（可选，用于 NAT 穿透）
```

## Webhook 端点

该服务暴露一个 HTTP 端点来接收 Sylvode 的 Webhook 事件。每个传入请求都使用 **HMAC-SHA256** 签名验证，基于 Sylvode 和调度器之间配置的共享密钥。

支持的事件类型包括 `issue.created`、`issue.updated` 和其他 Sylvode 生命周期事件。调度器过滤这些事件以识别**机器人任务**——指派人是机器人用户的事件——并忽略仅人类的分配。

## 代理类型

调度器支持五种代理类型：

| 代理类型 | 说明 |
|----------|------|
| `openclaw` | 通过 OpenClaw CLI 发送通知（Signal、Telegram） |
| `openprx` | 通过 OpenPRX Signal API 或 CLI 发送通知 |
| `webhook` | 将事件转发到外部 HTTP 端点 |
| `custom` | 运行用户自定义命令 |
| `cli` | 在本地运行白名单内的编码代理 |

## CLI 执行器

CLI 执行器是主要的派发机制。它以受控参数将编码代理作为子进程启动。

### 白名单 CLI

仅允许以下 CLI 工具：

| CLI | 说明 |
|-----|------|
| `codex` | OpenAI Codex CLI 代理 |
| `claude-code` | Anthropic Claude Code CLI 代理 |
| `opencode` | 开源编码代理 |

任何尝试执行不在白名单中的二进制文件都会被拒绝。

### 执行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 工作目录 | 每个代理配置 | 代码仓库的检出路径 |
| 超时 | 900 秒（15 分钟） | 强制终止前的最大执行时间 |
| 提示词模板 | `Fix issue {issue_id}: {title}` | 带有 Issue 上下文占位符的模板 |

### 提示词模板

`prompt_template` 支持从 Webhook 事件载荷中填充的占位符：`{issue_id}`、`{title}`、`{reason}`、`{event}`、`{project_id}`、`{form_id}`、`{form_key}` 和 `{record_id}`。

```toml
prompt_template = "Fix issue {issue_id}: {title}\nContext: {reason}"
```

## 回调循环

代理完成工作后，结果通过以下方式发回 Sylvode：

- **MCP** -- 代理直接调用 Sylvode 的 MCP 工具来更新 Issue 状态、添加评论和转换状态
- **API** -- 直接调用 Sylvode HTTP 端点的 REST API

回调使用代理的输出更新 Issue，并转换其状态（成功时通常从 `in_progress` 到 `done`，失败时添加包含错误详情的评论）。

## WSS 隧道

对于代理主机位于 NAT 或防火墙后的部署，Sylvode Webhook 支持到 Sylvode 控制面的出站 **WebSocket Secure (WSS) 隧道**。

隧道流程：

1. Sylvode Webhook 打开到 Sylvode 的出站 WSS 连接
2. Sylvode 通过隧道推送任务事件
3. 调度器确认接收，在本地执行代理
4. 结果通过同一隧道连接返回

这避免了代理主机上的入站端口转发或公共 IP 地址需求。

## 安全控制

Sylvode Webhook 采用纵深防御设计：

### 功能门控

风险较高的路径位于 `[features]` 段的功能门控之后，默认均为 **false**：

| 功能 | 默认值 | 说明 |
|------|--------|------|
| `cli_enabled` | `false` | 启用本地 CLI 代理执行 |
| `tunnel_enabled` | `false` | 启用 WSS 隧道连接（还需 `[tunnel].enabled = true`） |
| `callback_enabled` | `false` | 启用向 Sylvode 的结果回调 |

### 安全模式

设置环境变量 `SYLVODE_WEBHOOK_SAFE_MODE=1`（也接受 `true`、`yes`、`on`）会在运行时强制关闭 CLI、隧道和回调路径，无论配置文件如何设置。这是一键回退到纯 Webhook 行为的开关：事件仍会被验证并转发给通知类代理，但不会启动任何编码代理。旧变量名 `OPENPR_WEBHOOK_SAFE_MODE` 仍会被读取并给出弃用提示，最早在 v2.0 才会移除。

### 执行器白名单

严格的 CLI 白名单（`codex`、`claude-code`、`opencode`）防止任意命令执行。白名单编译到二进制文件中，不能仅通过配置在运行时修改。

## 配置

```toml
[server]
listen = "0.0.0.0:9090"

[security]
webhook_secrets = ["your-hmac-secret"]

[features]
cli_enabled = true

[[agents]]
id = "ai-fixer"
name = "AI Issue Fixer"
agent_type = "cli"

[agents.cli]
executor = "claude-code" # codex | claude-code | opencode
workdir = "/opt/repos/my-project"
timeout_secs = 900
prompt_template = "Fix issue {issue_id}: {title}\nContext: {reason}"
```

完整参考见[仓库](https://github.com/openprx/openpr-webhook)中的 `config.example.toml`。

## 运行

```bash
# 构建（在 openpr-webhook 仓库检出目录中）
cargo build --release

# 使用工作目录中的 config.toml 运行
./target/release/sylvode-webhook

# 使用显式配置路径运行
./target/release/sylvode-webhook /etc/sylvode-webhook/config.toml
```

配置路径是位置参数；`--help` 与 `--version` 分别输出用法和版本。发布归档和容器镜像 `ghcr.io/openprx/sylvode-webhook` 提供同一个可执行文件。旧可执行名 `openpr-webhook` 仍可使用并会输出弃用提示；旧镜像名 `ghcr.io/openprx/openpr-webhook` 以相同 digest 发布。两者最早在 v2.0 才会移除。
