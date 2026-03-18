---
title: 通道
description: PRX 通过统一的 Channel trait 连接 19 个消息平台，每个通道拥有独立的策略、历史和并发控制。
sidebar:
  order: 2
---

PRX 通过**通道**进行通信——实现通用 `Channel` trait 的消息集成。每个通道运行自己的监听循环，维护每个发送者的对话历史，并执行独立的访问策略。

## 支持的通道

| 通道 | 后端 | 协议 | 备注 |
|------|------|------|------|
| Signal (CLI) | signal-cli | D-Bus / JSON-RPC | 基于 CLI 的 Signal 客户端 |
| Signal (原生) | libsignal | Signal 协议 | 原生 Rust 实现 |
| WhatsApp (whatsmeow) | whatsmeow 桥接 | WebSocket | 基于 Go 的 WhatsApp Web 桥接 |
| WhatsApp (wacli) | wacli | CLI | 轻量级 WhatsApp CLI |
| WhatsApp (wa-rs) | wa-rs | 原生 | 纯 Rust WhatsApp 客户端 |
| Telegram | teloxide | Bot API | 完整的 Bot API 支持 |
| Discord | serenity | Gateway WebSocket | 斜杠命令和消息事件 |
| Slack | slack-morphism | Events API + WebSocket | 兼容 Bolt 的事件处理 |
| Matrix | matrix-sdk | 客户端-服务器 API | 通过 vodozemac 完整支持 E2EE |
| iMessage | applescript / imessage-rs | AppleScript / BlueBubbles | 仅 macOS |
| IRC | irc crate | IRC 协议 | 标准 IRC，支持 TLS |
| Email | IMAP + SMTP | IMAP IDLE / 轮询 | 支持 HTML 和附件 |
| 钉钉 | 钉钉开放 API | HTTP Webhook + WebSocket | 中国企业消息 |
| 飞书 | 飞书开放 API | HTTP Webhook + WebSocket | 字节跳动企业套件 |
| QQ | OpenShamrock / Lagrange | OneBot v11 | 通过反向 WebSocket 的 QQ 机器人 |
| Mattermost | Mattermost API | WebSocket + REST | 自托管团队聊天 |
| Nextcloud Talk | Nextcloud Talk API | 轮询 | 自托管协作工具 |
| LinQ | LinQ 协议 | 自定义 | 内部消息协议 |
| CLI | stdin/stdout | TTY | 本地交互模式 |

## 通道配置

每个通道独立配置，包含访问控制策略：

```toml
[channels.telegram]
enabled = true
token = "BOT_TOKEN"

# DM 策略：谁可以直接向机器人发消息
dm_policy = "allowlist"        # "allowlist" | "open" | "disabled"
dm_allowlist = [123456789, 987654321]

# 群组策略：机器人在哪些群组中响应
group_policy = "allowlist"     # "allowlist" | "open" | "disabled"
group_allowlist = [-1001234567890]

# 发送者白名单（同时适用于 DM 和群组）
sender_allowlist = ["user_id_1", "user_id_2"]
```

### 策略模式

| 策略 | 行为 |
|------|------|
| `allowlist` | 仅明确列出的用户/群组可以交互 |
| `open` | 任何人都可以交互（请谨慎使用） |
| `disabled` | 通道方向（DM 或群组）完全关闭 |

## 消息流

每条传入消息遵循以下流程：

```
通道监听循环
  │
  ├─ 1. 从平台接收消息
  │
  ├─ 2. 策略检查（dm_policy / group_policy / sender_allowlist）
  │     拒绝 → 静默丢弃
  │
  ├─ 3. 每发送者历史查找
  │     每个发送者维护 50 条消息的滚动窗口
  │
  ├─ 4. 并发控制
  │     每个通道最多 4 个并行请求
  │     超出的请求进入队列
  │
  ├─ 5. 超时预算
  │     每个请求的超时，防止 LLM 挂起
  │
  ├─ 6. 通过路由器路由到 LLM
  │     意图分类 → 模型选择 → 生成
  │
  ├─ 7. 将响应发回通道
  │
  ├─ 8. 记忆自动保存
  │     重要对话持久化到 prx-memory
  │
  └─ 9. 历史压缩
        当历史超过 50 条消息时，旧条目
        被总结和压缩以保持上下文质量
```

## 对话历史

PRX 维护每个发送者**最近 50 条消息**的对话缓冲区。这不是简单的截断：

- 消息带有时间戳、角色（用户/助手）和通道元数据
- 当缓冲区满时，最旧的消息被压缩为摘要
- 摘要添加到历史开头，在不消耗完整令牌窗口的情况下保留上下文
- 历史按发送者隔离——对话不会在用户之间泄露

## 并发控制

每个通道强制执行最多 **4 个并行 LLM 请求**。这可以防止：

- LLM 供应商的速率限制耗尽
- 过多并发上下文窗口的内存压力
- 快速响应突发导致的平台端限流

超出并发限制的请求在 FIFO 队列中等待，当槽位释放时处理。

## 网关 HTTP 服务器

PRX 为通过 Webhook 而非持久连接通信的通道暴露 HTTP 网关。用于：

- 钉钉（事件订阅回调）
- 飞书（事件订阅回调）
- Slack（Events API 模式）
- 通过 HTTP 向 PRX 发送的自定义集成

网关验证传入的 Webhook 签名，将载荷映射为内部消息格式，并送入相同的消息流处理流程。
