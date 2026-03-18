---
title: Channels
description: PRX connects to 19 messaging platforms through a unified Channel trait, each with independent policy, history, and concurrency control.
sidebar:
  order: 2
---

PRX communicates through **channels** — messaging integrations that implement a common `Channel` trait. Each channel runs its own listener loop, maintains per-sender conversation history, and enforces independent access policies.

## Supported Channels

| Channel | Backend | Protocol | Notes |
|---------|---------|----------|-------|
| Signal (CLI) | signal-cli | D-Bus / JSON-RPC | CLI-based Signal client |
| Signal (native) | libsignal | Signal protocol | Native Rust implementation |
| WhatsApp (whatsmeow) | whatsmeow bridge | WebSocket | Go-based WhatsApp Web bridge |
| WhatsApp (wacli) | wacli | CLI | Lightweight WhatsApp CLI |
| WhatsApp (wa-rs) | wa-rs | Native | Pure Rust WhatsApp client |
| Telegram | teloxide | Bot API | Full bot API support |
| Discord | serenity | Gateway WebSocket | Slash commands and message events |
| Slack | slack-morphism | Events API + WebSocket | Bolt-compatible event handling |
| Matrix | matrix-sdk | Client-Server API | Full E2EE support via vodozemac |
| iMessage | applescript / imessage-rs | AppleScript / BlueBubbles | macOS only |
| IRC | irc crate | IRC protocol | Standard IRC with TLS |
| Email | IMAP + SMTP | IMAP IDLE / polling | Supports HTML and attachments |
| DingTalk | DingTalk Open API | HTTP webhook + WebSocket | China enterprise messaging |
| Lark / Feishu | Lark Open API | HTTP webhook + WebSocket | Bytedance enterprise suite |
| QQ | OpenShamrock / Lagrange | OneBot v11 | QQ Bot via reverse WebSocket |
| Mattermost | Mattermost API | WebSocket + REST | Self-hosted team chat |
| Nextcloud Talk | Nextcloud Talk API | Polling | Self-hosted collaboration |
| LinQ | LinQ protocol | Custom | Internal messaging protocol |
| CLI | stdin/stdout | TTY | Local interactive mode |

## Channel Configuration

Each channel is configured independently with access control policies:

```toml
[channels.telegram]
enabled = true
token = "BOT_TOKEN"

# DM policy: who can message the bot directly
dm_policy = "allowlist"        # "allowlist" | "open" | "disabled"
dm_allowlist = [123456789, 987654321]

# Group policy: which groups the bot responds in
group_policy = "allowlist"     # "allowlist" | "open" | "disabled"
group_allowlist = [-1001234567890]

# Sender allowlist (applies to both DM and group)
sender_allowlist = ["user_id_1", "user_id_2"]
```

### Policy Modes

| Policy | Behavior |
|--------|----------|
| `allowlist` | Only explicitly listed users/groups can interact |
| `open` | Anyone can interact (use with caution) |
| `disabled` | Channel direction (DM or group) is turned off entirely |

## Message Flow

Every incoming message follows this pipeline:

```
Channel Listener Loop
  │
  ├─ 1. Receive message from platform
  │
  ├─ 2. Policy check (dm_policy / group_policy / sender_allowlist)
  │     Denied → silently drop
  │
  ├─ 3. Per-sender history lookup
  │     Each sender maintains a rolling window of 50 messages
  │
  ├─ 4. Concurrency control
  │     Max 4 parallel requests per channel
  │     Excess requests are queued
  │
  ├─ 5. Timeout budget
  │     Per-request timeout to prevent LLM hangs
  │
  ├─ 6. Route to LLM via Router
  │     Intent classification → model selection → generation
  │
  ├─ 7. Send response back to channel
  │
  ├─ 8. Memory auto-save
  │     Significant conversations are persisted to prx-memory
  │
  └─ 9. History compaction
        When history exceeds 50 messages, older entries are
        summarized and compressed to maintain context quality
```

## Conversation History

PRX maintains a per-sender conversation buffer of the **last 50 messages**. This is not a simple truncation:

- Messages are stored with timestamps, role (user/assistant), and channel metadata
- When the buffer is full, the oldest messages are compacted into a summary
- The summary is prepended to the history so context is preserved without consuming the full token window
- History is isolated per sender — conversations do not leak between users

## Concurrency Control

Each channel enforces a maximum of **4 parallel LLM requests**. This prevents:

- Rate limit exhaustion on LLM providers
- Memory pressure from too many concurrent context windows
- Platform-side throttling from rapid response bursts

Requests beyond the concurrency limit are held in a FIFO queue and processed as slots free up.

## Gateway HTTP Server

PRX exposes an HTTP gateway for channels that communicate via webhooks rather than persistent connections. This is used by:

- DingTalk (event subscription callbacks)
- Lark / Feishu (event subscription callbacks)
- Slack (Events API mode)
- Custom integrations posting to PRX via HTTP

The gateway validates incoming webhook signatures, maps payloads to the internal message format, and feeds them into the same message flow pipeline.
