---
title: "AI 任务系统"
description: "OpenPR 如何通过 Webhook 将工作项派发给 AI 编码代理，并通过 API 回调接收结果。"
sidebar:
  order: 4
---

AI 任务系统是 OpenPR 将工作分配给 AI 编码代理的机制。它弥合了人类在项目跟踪器中创建 Issue 与 AI 代理自主编写代码解决问题之间的差距。

## 概述

该系统有四个组件：

1. **API** -- 创建任务、管理状态、接收代理的回调
2. **Worker** -- 后台进程，轮询待处理任务并通过 Webhook 派发
3. **Webhook** -- 向代理端点发送带任务详情的 HTTP POST
4. **代理** -- 执行任务并回报结果的 AI 编码工具（Codex、Claude Code、OpenCode）

```
Issue 分配给机器人
        |
        v
  API 创建 ai_task（状态：pending）
        |
        v
  Worker 领取任务（状态：processing）
        |
        v
  Worker 通过 Webhook POST 派发
        |
        v
  代理执行（编写代码、运行测试）
        |
        v
  代理调用 API 回调
        |
        v
  任务标记为 completed 或 failed
```

## 任务生命周期

### 状态转换

```
pending --> processing --> completed
    ^           |
    |           v
    +------- failed（如有剩余重试次数，回到 pending）
```

| 状态 | 含义 |
|------|------|
| `pending` | 任务已入队，等待 Worker 领取 |
| `processing` | Worker 已认领任务并派发给代理 |
| `completed` | 代理报告成功完成 |
| `failed` | 代理报告失败或所有重试次数已用完 |
| `cancelled` | 任务被手动取消 |

### 重试机制

每个任务有可配置的 `max_attempts`（默认：3）。当派发失败或代理报告失败时：

1. 如果 `attempts < max_attempts`，任务回到 `pending` 状态并设置 `next_retry_at` 时间戳
2. 重试退避为线性：`attempts * 30 秒`，上限 600 秒（10 分钟）
3. 如果所有尝试都已用完，任务转为 `failed` 并触发 `ai.task_failed` Webhook 事件

### 事件日志

每次状态转换都记录在 `ai_task_events` 表中，包含带时间戳的事件类型和载荷：

| 事件类型 | 触发时机 |
|----------|----------|
| `created` | 任务初始创建 |
| `picked_up` | Worker 认领任务进行处理 |
| `progress` | 代理报告中间进度 |
| `completed` | 代理报告成功完成 |
| `retried` | 任务在失败后回到 pending |
| `failed` | 任务用完所有重试次数 |

## 任务类型

系统支持四种任务类型：

| 类型 | 说明 | 引用类型 |
|------|------|----------|
| `issue_assigned` | Issue 已分配给机器人进行实现 | `work_item` |
| `review_requested` | 请求代码审查或提案审查 | `proposal` |
| `comment_requested` | 请求机器人对 Issue 或提案发表评论 | `comment` |
| `vote_requested` | 请求机器人对治理提案投票 | `proposal` |

## 机器人用户和认证

### 机器人用户账号

AI 代理在系统中表示为 `entity_type = 'bot'` 的用户。它们像其他用户一样注册在 `users` 表中，但认证方式不同。

### 机器人令牌

机器人令牌使用 `opr_` 前缀，具有工作区范围。以 SHA-256 哈希形式存储在 `workspace_bots` 表中。

```
Authorization: Bearer opr_0a5bc81ea108dad8077decc880abced0d923aa873b9ff774575ec152aecf15d5
```

机器人令牌包含：

| 字段 | 说明 |
|------|------|
| `workspace_id` | 令牌所属的工作区 |
| `permissions` | 权限字符串数组（`read`、`write`、`admin`） |
| `is_active` | 令牌当前是否有效 |
| `expires_at` | 可选的过期时间戳 |
| `last_used_at` | 每次 API 调用时自动更新 |

### AI 参与者

机器人用户通过 `ai_participants` 表注册为特定项目的 AI 参与者。每个参与者有：

| 字段 | 说明 |
|------|------|
| `name` | 显示名称（如 "Claude Agent"） |
| `model` | 模型标识（如 "claude-opus-4"） |
| `provider` | 供应商名称（如 "anthropic"） |
| `capabilities` | 描述代理能力的 JSON 对象 |
| `max_domain_level` | 自治级别：`observer`、`advisor`、`voter`、`vetoer`、`autonomous` |
| `can_veto_human_consensus` | 代理是否可以推翻人类投票 |
| `reason_min_length` | 投票理由的最小长度 |
| `is_active` | 参与者是否启用 |

## Worker 进程

Worker 是一个独立的 Rust 二进制程序，作为后台服务运行。它每 5 秒轮询 `ai_tasks` 表查找待处理任务。

### 任务领取

Worker 使用 PostgreSQL `FOR UPDATE SKIP LOCKED` 在并发环境中安全地认领任务：

1. 查询 `next_retry_at` 为空或已过期的 pending 任务
2. 原子地将状态更新为 `processing` 并递增 `attempts`
3. 记录 `picked_up` 事件

任务按 `priority DESC, created_at ASC` 排序——高优先级任务优先处理，同优先级按创建时间先后顺序。

### 派发

对于每个认领的任务，Worker：

1. 查找任务项目中该机器人用户的活跃 Webhook
2. 构建包含任务详情的派发载荷
3. 向 Webhook URL 发送 HTTP POST
4. 如果 POST 失败，记录失败并进行重试或将任务标记为失败

### 派发载荷

发送给代理的 Webhook POST 请求体包含：

```json
{
  "task_id": "uuid",
  "project_id": "uuid",
  "ai_participant_id": "uuid",
  "task_type": "issue_assigned",
  "reference_type": "work_item",
  "reference_id": "uuid",
  "payload": {
    "issue_title": "Fix authentication flow",
    "issue_description": "The login endpoint returns 500..."
  },
  "attempts": 1,
  "max_attempts": 3
}
```

### 并发控制

Worker 接受 `--concurrency` 参数（默认：4），控制每个轮询周期领取多少任务。实际批次大小为 `concurrency * 10`。

## 代理回调 API

执行任务后，代理通过 REST API 向 OpenPR 回报结果。

### 完成任务

```
POST /api/projects/:project_id/ai-tasks/:task_id/complete
Authorization: Bearer opr_...
Content-Type: application/json

{
  "summary": "Fixed the authentication flow by...",
  "files_changed": ["src/auth.rs", "src/middleware.rs"],
  "commit_sha": "abc123"
}
```

请求体存储为任务的 `result` 字段。任务转为 `completed` 状态，并触发 `ai.task_completed` Webhook 事件。

### 失败任务

```
POST /api/projects/:project_id/ai-tasks/:task_id/fail
Authorization: Bearer opr_...
Content-Type: application/json

{
  "error_message": "Test suite failed with 3 errors",
  "payload": {
    "test_output": "..."
  }
}
```

如果任务还有剩余重试次数，它将带退避延迟回到 `pending`。否则转为 `failed` 并触发 `ai.task_failed` Webhook 事件。

### 报告进度

```
POST /api/projects/:project_id/ai-tasks/:task_id/progress
Authorization: Bearer opr_...
Content-Type: application/json

{
  "step": "running tests",
  "progress_pct": 75
}
```

进度报告记录为 `ai_task_events` 中的 `progress` 事件，但不会改变任务状态。

## 创建任务

### 自动创建（通过 Issue 分配）

当 Issue 分配给机器人用户且存在匹配的 `bot_user_id` Webhook 时，Issue 分配会触发创建 `issue_assigned` AI 任务。

### 自动创建（通过治理）

当提案进入投票阶段时，会自动为项目中所有活跃的 AI 参与者创建 `vote_requested` 任务。这由 `queue_vote_requested_tasks_for_project` 处理，遍历活跃的机器人用户并创建幂等任务。

### 手动创建（通过 API）

```
POST /api/projects/:project_id/ai-tasks
Authorization: Bearer <jwt_or_bot_token>
Content-Type: application/json

{
  "ai_participant_id": "bot-user-uuid",
  "task_type": "issue_assigned",
  "reference_type": "work_item",
  "reference_id": "issue-uuid",
  "priority": 5,
  "payload": { "instructions": "..." },
  "max_attempts": 3,
  "idempotency_key": "unique-key-to-prevent-duplicates"
}
```

`idempotency_key` 防止重复创建任务。如果已存在相同键的任务，API 返回 409 Conflict。

## 权限

| 操作 | 谁可以执行 |
|------|------------|
| 创建任务 | 项目管理员/所有者或系统管理员 |
| 完成/失败任务 | 被分配的 AI 参与者或系统管理员 |
| 报告进度 | 被分配的 AI 参与者或系统管理员 |
| 列出任务 | 任何项目成员 |

## 相关文档

- [OpenPR 概览](/docs/plan/overview/) -- 架构和部署
- [MCP 服务器](/docs/plan/mcp-server/) -- 34 个代理交互工具
- [Webhooks](/docs/plan/webhooks/) -- 事件类型，包括 `ai.task_completed` 和 `ai.task_failed`
- [治理](/docs/plan/governance/) -- `vote_requested` 任务如何自动创建
- [架构概览](/docs/getting-started/architecture/) -- 完整流水线数据流
