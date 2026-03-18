---
title: "AI Task System"
description: "How OpenPR dispatches work items to AI coding agents via webhooks and receives results through API callbacks."
sidebar:
  order: 4
---

The AI task system is the mechanism by which OpenPR assigns work to AI coding agents. It bridges the gap between a human creating an issue in a project tracker and an AI agent autonomously writing code to resolve it.

## Overview

The system has four components:

1. **API** -- Creates tasks, manages state, receives callbacks from agents
2. **Worker** -- Background process that polls for pending tasks and dispatches them via webhooks
3. **Webhook** -- HTTP POST to the agent's endpoint with task details
4. **Agent** -- The AI coding tool (Codex, Claude Code, OpenCode) that executes the task and reports back

```
Issue assigned to bot
        |
        v
  API creates ai_task (status: pending)
        |
        v
  Worker picks up task (status: processing)
        |
        v
  Worker dispatches via webhook POST
        |
        v
  Agent executes (writes code, runs tests)
        |
        v
  Agent calls API callback
        |
        v
  Task marked completed or failed
```

## Task Lifecycle

### State Transitions

```
pending --> processing --> completed
    ^           |
    |           v
    +------- failed (if retries remain, back to pending)
```

| Status | Meaning |
|--------|---------|
| `pending` | Task is queued, waiting for the worker to pick it up |
| `processing` | Worker has claimed the task and dispatched it to an agent |
| `completed` | Agent reported successful completion |
| `failed` | Agent reported failure or all retry attempts exhausted |
| `cancelled` | Task was manually cancelled |

### Retry Mechanism

Each task has a configurable `max_attempts` (default: 3). When a dispatch fails or an agent reports failure:

1. If `attempts < max_attempts`, the task returns to `pending` status with a `next_retry_at` timestamp
2. Retry backoff is linear: `attempts * 30 seconds`, capped at 600 seconds (10 minutes)
3. If all attempts are exhausted, the task moves to `failed` and an `ai.task_failed` webhook is fired

### Event Log

Every state transition is recorded in the `ai_task_events` table with a timestamped event type and payload:

| Event Type | When |
|------------|------|
| `created` | Task is initially created |
| `picked_up` | Worker claims the task for processing |
| `progress` | Agent reports intermediate progress |
| `completed` | Agent reports successful completion |
| `retried` | Task is returned to pending after a failure |
| `failed` | Task exhausts all retry attempts |

## Task Types

The system supports four task types:

| Type | Description | Reference Type |
|------|-------------|----------------|
| `issue_assigned` | An issue has been assigned to the bot for implementation | `work_item` |
| `review_requested` | A code review or proposal review is requested | `proposal` |
| `comment_requested` | The bot is asked to comment on an issue or proposal | `comment` |
| `vote_requested` | The bot is asked to vote on a governance proposal | `proposal` |

## Bot Users and Authentication

### Bot User Accounts

AI agents are represented as users with `entity_type = 'bot'`. They are registered in the `users` table like any other user but authenticate differently.

### Bot Tokens

Bot tokens use the `opr_` prefix and are workspace-scoped. They are stored in the `workspace_bots` table as SHA-256 hashes.

```
Authorization: Bearer opr_0a5bc81ea108dad8077decc880abced0d923aa873b9ff774575ec152aecf15d5
```

Bot tokens carry:

| Field | Description |
|-------|-------------|
| `workspace_id` | Workspace the token is scoped to |
| `permissions` | Array of permission strings (`read`, `write`, `admin`) |
| `is_active` | Whether the token is currently valid |
| `expires_at` | Optional expiration timestamp |
| `last_used_at` | Automatically updated on each API call |

### AI Participants

Bot users are registered as AI participants in specific projects via the `ai_participants` table. Each participant has:

| Field | Description |
|-------|-------------|
| `name` | Display name (e.g., "Claude Agent") |
| `model` | Model identifier (e.g., "claude-opus-4") |
| `provider` | Provider name (e.g., "anthropic") |
| `capabilities` | JSON object describing what the agent can do |
| `max_domain_level` | Autonomy level: `observer`, `advisor`, `voter`, `vetoer`, `autonomous` |
| `can_veto_human_consensus` | Whether the agent can override human votes |
| `reason_min_length` | Minimum length for vote justifications |
| `is_active` | Whether the participant is enabled |

## Worker Process

The worker is a standalone Rust binary that runs as a background service. It polls the `ai_tasks` table every 5 seconds for pending tasks.

### Task Pickup

The worker uses PostgreSQL `FOR UPDATE SKIP LOCKED` to safely claim tasks in a concurrent environment:

1. Query for pending tasks where `next_retry_at` is null or in the past
2. Atomically update their status to `processing` and increment `attempts`
3. Record a `picked_up` event

Tasks are ordered by `priority DESC, created_at ASC` -- higher-priority tasks are processed first, with older tasks breaking ties.

### Dispatch

For each claimed task, the worker:

1. Looks up the active webhook for the bot user in the task's project
2. Constructs a dispatch payload with task details
3. Sends an HTTP POST to the webhook URL
4. If the POST fails, records the failure and either retries or marks the task as failed

### Dispatch Payload

The webhook POST body sent to the agent contains:

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

### Concurrency

The worker accepts a `--concurrency` flag (default: 4) that controls how many tasks are picked up per polling cycle. The actual batch size is `concurrency * 10`.

## Agent Callback API

After executing a task, the agent reports results back to OpenPR through the REST API.

### Complete a Task

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

The request body is stored as the task's `result` field. The task moves to `completed` status and an `ai.task_completed` webhook event is fired.

### Fail a Task

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

If the task has remaining retry attempts, it returns to `pending` with a backoff delay. Otherwise, it moves to `failed` and an `ai.task_failed` webhook event is fired.

### Report Progress

```
POST /api/projects/:project_id/ai-tasks/:task_id/progress
Authorization: Bearer opr_...
Content-Type: application/json

{
  "step": "running tests",
  "progress_pct": 75
}
```

Progress reports are recorded as `progress` events in `ai_task_events` but do not change the task status.

## Creating Tasks

### Automatic (via Issue Assignment)

When an issue is assigned to a bot user and a webhook with matching `bot_user_id` exists, the issue assignment triggers the creation of an `issue_assigned` AI task.

### Automatic (via Governance)

When a proposal enters the voting phase, `vote_requested` tasks are automatically created for all active AI participants in the project. This is handled by `queue_vote_requested_tasks_for_project` which iterates over active bot users and creates idempotent tasks.

### Manual (via API)

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

The `idempotency_key` prevents duplicate task creation. If a task with the same key already exists, the API returns a 409 Conflict.

## Permissions

| Operation | Who Can Do It |
|-----------|---------------|
| Create task | Project admin/owner or system admin |
| Complete/fail task | The assigned AI participant or system admin |
| Report progress | The assigned AI participant or system admin |
| List tasks | Any project member |

## Related

- [OpenPR Overview](/docs/plan/overview/) -- Architecture and deployment
- [MCP Server](/docs/plan/mcp-server/) -- 34 tools for agent interaction
- [Webhooks](/docs/plan/webhooks/) -- Event types including `ai.task_completed` and `ai.task_failed`
- [Governance](/docs/plan/governance/) -- How `vote_requested` tasks are auto-created
- [Architecture Overview](/docs/getting-started/architecture/) -- Full pipeline data flow
