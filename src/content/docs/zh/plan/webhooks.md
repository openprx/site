---
title: "Webhooks"
description: "OpenPR 触发 30 种 HMAC-SHA256 签名的 Webhook 事件类型，覆盖 Issue、评论、Sprint、治理和 AI 任务生命周期。"
sidebar:
  order: 3
---

OpenPR 使用 Webhook 实时通知外部系统状态变更。每次 Webhook 投递都使用 HMAC-SHA256 签名，记录在 `webhook_deliveries` 表中以供审计，并包含丰富的上下文数据供下游自动化使用。

## Webhook 工作原理

1. 发生状态变更（Issue 创建、Sprint 启动、提案提交等）
2. OpenPR 查询 `webhooks` 表中工作区内订阅了该事件类型的活跃 Webhook
3. 为每个匹配的 Webhook 构建包含完整实体数据的载荷
4. 使用 Webhook 的密钥通过 HMAC-SHA256 对载荷签名
5. 向 Webhook URL 发送带签名头的 HTTP POST 请求
6. 在 `webhook_deliveries` 中记录投递结果（状态、响应体、耗时）

## 事件类型

OpenPR 触发 30 种事件类型，分为七个类别。

### Issue 事件（5 种）

| 事件 | 触发时机 |
|------|----------|
| `issue.created` | 创建新 Issue |
| `issue.updated` | Issue 字段被修改（包含 `changes` 差异） |
| `issue.assigned` | Issue 指派人变更（包含旧/新指派人 ID） |
| `issue.state_changed` | Issue 状态变更（包含旧/新状态） |
| `issue.deleted` | Issue 被删除 |

### 评论事件（3 种）

| 事件 | 触发时机 |
|------|----------|
| `comment.created` | Issue 新增评论（包含 `mentions` 数组） |
| `comment.updated` | 评论被编辑 |
| `comment.deleted` | 评论被删除 |

### 标签事件（2 种）

| 事件 | 触发时机 |
|------|----------|
| `label.added` | 标签被添加到 Issue |
| `label.removed` | 标签从 Issue 移除 |

### Sprint 事件（2 种）

| 事件 | 触发时机 |
|------|----------|
| `sprint.started` | Sprint 状态变为活跃 |
| `sprint.completed` | Sprint 标记为已完成 |

### 项目和成员事件（5 种）

| 事件 | 触发时机 |
|------|----------|
| `project.created` | 创建新项目 |
| `project.updated` | 项目字段被修改 |
| `project.deleted` | 项目被删除 |
| `member.added` | 用户加入工作区 |
| `member.removed` | 用户从工作区移除 |

### 治理事件（9 种）

| 事件 | 触发时机 |
|------|----------|
| `proposal.created` | 新提案被起草 |
| `proposal.updated` | 提案字段被修改 |
| `proposal.deleted` | 提案被删除 |
| `proposal.submitted` | 提案提交审核 |
| `proposal.voting_started` | 提案开始投票 |
| `proposal.archived` | 提案被归档 |
| `proposal.vote_cast` | 对提案进行投票 |
| `veto.exercised` | 否决权人行使否决权 |
| `veto.withdrawn` | 否决权被撤回 |

### 升级和申诉事件（2 种）

| 事件 | 触发时机 |
|------|----------|
| `escalation.started` | 升级流程开始 |
| `appeal.created` | 对决策提起申诉 |

### 配置事件（1 种）

| 事件 | 触发时机 |
|------|----------|
| `governance_config.updated` | 治理配置被更改 |

### AI 任务事件（2 种）

| 事件 | 触发时机 |
|------|----------|
| `ai.task_completed` | AI 任务成功完成 |
| `ai.task_failed` | AI 任务在重试耗尽后失败 |

## Webhook 配置

Webhook 通过 API 按工作区配置。每个 Webhook 指定：

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | string | 接收事件的 HTTPS 端点 |
| `secret` | string | HMAC-SHA256 签名的共享密钥 |
| `events` | JSONB | 订阅的事件类型数组 |
| `active` | boolean | 启用或禁用该 Webhook |
| `bot_user_id` | UUID（可选） | 设置后启用机器人上下文增强，用于 AI 任务派发 |

当设置了 `bot_user_id` 且事件涉及分配给该机器人的 Issue 时，载荷中包含带有代理派发信息的 `bot_context` 对象。

## 载荷结构

每次 Webhook 投递包含以下 HTTP 头：

| 头 | 值 |
|----|-----|
| `Content-Type` | `application/json` |
| `User-Agent` | `OpenPR-Webhook/1.0` |
| `X-Webhook-Signature` | `sha256=<十六进制编码的 HMAC>` |
| `X-Webhook-Event` | 事件类型（如 `issue.created`） |
| `X-Webhook-Delivery` | 唯一投递 UUID |

### 载荷正文

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event": "issue.created",
  "timestamp": "2026-03-18T10:30:00.000Z",
  "workspace": {
    "id": "workspace-uuid",
    "name": "My Workspace"
  },
  "project": {
    "id": "project-uuid",
    "name": "Backend API",
    "key": "IM01"
  },
  "actor": {
    "id": "user-uuid",
    "name": "Admin",
    "email": "admin@example.com",
    "entity_type": "human"
  },
  "data": {
    "issue": {
      "id": "issue-uuid",
      "key": "IM01-A1B2C3D4",
      "title": "Fix authentication flow",
      "description": "The login endpoint returns 500...",
      "state": "todo",
      "priority": "high",
      "assignee_ids": ["bot-uuid"],
      "label_ids": ["label-uuid"],
      "sprint_id": "sprint-uuid",
      "created_at": "2026-03-18T10:30:00.000Z",
      "updated_at": "2026-03-18T10:30:00.000Z"
    }
  },
  "bot_context": {
    "is_bot_task": true,
    "bot_id": "bot-uuid",
    "bot_name": "Claude Agent",
    "bot_agent_type": "claude-code",
    "trigger_reason": "created",
    "webhook_id": "webhook-uuid"
  }
}
```

### 机器人上下文

`bot_context` 字段仅在以下情况存在：

1. Webhook 配置了 `bot_user_id`，且
2. Issue 分配给了该机器人用户，或
3. 机器人在评论中被 `@提及`

`trigger_reason` 字段指示机器人被触发的原因：

| 原因 | 时机 |
|------|------|
| `created` | Issue 创建时机器人为指派人 |
| `assigned` | Issue 被分配或更新时机器人为指派人 |
| `status_changed` | Issue 状态变更 |
| `mentioned` | 机器人在评论中被 `@提及` |
| `completed` | AI 任务完成 |
| `failed` | AI 任务失败 |

### 事件特定数据

对于 `issue.updated`、`issue.assigned` 和 `issue.state_changed` 事件，`data` 对象包含一个 `changes` 字段显示变更内容：

```json
{
  "data": {
    "issue": { "..." : "..." },
    "changes": {
      "state": {
        "old": "todo",
        "new": "in_progress"
      }
    }
  }
}
```

对于 `comment.created` 事件，`data` 包含一个用户 UUID 的 `mentions` 数组：

```json
{
  "data": {
    "comment": { "..." : "..." },
    "issue": { "..." : "..." },
    "mentions": ["user-uuid-1", "user-uuid-2"]
  }
}
```

## 签名验证

要验证 Webhook 投递，请使用你的 Webhook 密钥计算原始请求体的 HMAC-SHA256，并与 `X-Webhook-Signature` 头中的签名进行比较。

```python
import hmac
import hashlib

def verify_webhook(secret: str, body: bytes, signature_header: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

```javascript
const crypto = require("crypto");

function verifyWebhook(secret, body, signatureHeader) {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader)
  );
}
```

## 投递记录

每次 Webhook 投递都持久化到 `webhook_deliveries` 表，包含：

- 投递 UUID
- Webhook ID
- 事件类型
- 完整载荷（JSONB）
- 请求头
- 响应状态码
- 响应体
- 错误消息（如投递失败）
- 耗时（毫秒）
- 成功标志
- 时间戳

每次投递尝试后，Webhook 的 `last_triggered_at` 时间戳会被更新。

## 投递行为

- **超时**：每次投递尝试 10 秒
- **无自动重试**：失败的投递会被记录但不会重试（AI 任务系统有自己的重试机制）
- **异步派发**：Webhook 在后台 Tokio 任务中触发，不会阻塞 API 响应
- **尽力而为**：如果载荷构建失败，错误会被记录并跳过该 Webhook

## 相关文档

- [OpenPR 概览](/docs/plan/overview/) -- 架构和快速开始
- [AI 任务](/docs/plan/ai-tasks/) -- Webhook 如何驱动 AI 任务派发
- [治理](/docs/plan/governance/) -- 治理事件和配置
- [架构概览](/docs/getting-started/architecture/) -- 完整流水线通信
