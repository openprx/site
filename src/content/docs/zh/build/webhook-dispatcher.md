---
title: Webhook 调度器
description: "openpr-webhook：接收 OpenPR 事件并派发 AI 编码代理的 Rust 服务。"
sidebar:
  order: 2
---

openpr-webhook 是一个基于 Axum 构建的 Rust 服务，将 OpenPR 的项目管理事件与 AI 编码代理桥接起来。它接收 Webhook 事件，验证其真实性，并启动相应的代理来处理任务。

## 架构

```
OpenPR ──webhook──▶ openpr-webhook ──CLI──▶ AI 代理
                         │                      │
                         │◀─────callback─────────┘
                         │
                    WSS 隧道（可选，用于 NAT 穿透）
```

## Webhook 端点

该服务暴露一个 HTTP 端点来接收 OpenPR Webhook 事件。每个传入请求都使用 **HMAC-SHA256** 签名验证，基于 OpenPR 和调度器之间配置的共享密钥。

支持的事件类型包括 `issue.created`、`issue.updated` 和其他 OpenPR 生命周期事件。调度器过滤这些事件以识别**机器人任务**——指派人是机器人用户的事件——并忽略仅人类的分配。

## 代理类型

调度器支持五种代理类型：

| 代理类型 | 说明 |
|----------|------|
| `openclaw` | OpenPRX 默认编码代理 |
| `openprx` | 通用 OpenPRX 代理 |
| `webhook` | 将事件转发到外部 Webhook |
| `custom` | 用户自定义代理，带自定义配置 |
| `cli` | 本地执行的基于 CLI 的代理 |

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
| 提示词模板 | 每代理类型 | 带有 Issue 上下文占位符的模板 |

### 提示词模板

提示词模板支持从 Webhook 事件载荷中填充的占位符：

```
You are working on project {{project_name}}.
Issue #{{issue_number}}: {{issue_title}}

Description:
{{issue_description}}

Please implement the required changes and report your results.
```

## 回调循环

代理完成工作后，结果通过以下方式发回 OpenPR：

- **MCP** -- 代理直接调用 OpenPR 的 MCP 工具来更新 Issue 状态、添加评论和转换状态
- **API** -- 直接调用 OpenPR HTTP 端点的 REST API

回调使用代理的输出更新 Issue，并转换其状态（成功时通常从 `in_progress` 到 `done`，失败时添加包含错误详情的评论）。

## WSS 隧道

对于代理主机位于 NAT 或防火墙后的部署，openpr-webhook 支持到 OpenPR 控制面的出站 **WebSocket Secure (WSS) 隧道**。

隧道流程：

1. openpr-webhook 打开到 OpenPR 的出站 WSS 连接
2. OpenPR 通过隧道推送任务事件
3. 调度器确认接收，在本地执行代理
4. 结果通过同一隧道连接返回

这避免了代理主机上的入站端口转发或公共 IP 地址需求。

## 安全控制

openpr-webhook 采用纵深防御设计：

### 功能门控

所有功能都在功能门控后面，默认为 **false**：

| 功能 | 默认值 | 说明 |
|------|--------|------|
| `cli_executor` | `false` | 启用本地 CLI 代理执行 |
| `wss_tunnel` | `false` | 启用 WSS 隧道连接 |
| `webhook_forward` | `false` | 启用转发到外部 Webhook |
| `custom_agent` | `false` | 启用自定义代理配置 |

### 安全模式

启用安全模式后，调度器以只读观察模式运行：事件被接收和记录，但不派发代理。这对于在启用执行之前测试 Webhook 连接和验证事件载荷很有用。

### 执行器白名单

严格的 CLI 白名单（`codex`、`claude-code`、`opencode`）防止任意命令执行。白名单编译到二进制文件中，不能仅通过配置在运行时修改。

## 配置

```toml
[webhook]
secret = "your-hmac-secret"
listen = "0.0.0.0:8091"

[executor]
working_dir = "/opt/repos"
timeout_secs = 900
safe_mode = false

[agents.default]
type = "cli"
cli = "claude-code"
prompt_template = "default.txt"
```

## 运行

```bash
# 构建
cargo build --release

# 使用默认配置运行
./target/release/openpr-webhook

# 使用自定义配置路径运行
./target/release/openpr-webhook --config /etc/openpr-webhook/config.toml
```
