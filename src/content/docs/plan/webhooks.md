---
title: "Webhooks"
description: "OpenPR fires 30 HMAC-SHA256 signed webhook event types covering issues, comments, sprints, governance, and AI task lifecycle."
sidebar:
  order: 3
---

OpenPR uses webhooks to notify external systems of state changes in real time. Every webhook delivery is signed with HMAC-SHA256, recorded in the `webhook_deliveries` table for auditability, and includes rich contextual data for downstream automation.

## How Webhooks Work

1. A state change occurs (issue created, sprint started, proposal submitted, etc.)
2. OpenPR queries the `webhooks` table for active webhooks in the workspace that subscribe to that event type
3. For each matching webhook, a payload is constructed with full entity data
4. The payload is signed with the webhook's secret key using HMAC-SHA256
5. An HTTP POST is sent to the webhook URL with signature headers
6. The delivery result (status, body, duration) is recorded in `webhook_deliveries`

## Event Types

OpenPR fires 30 event types organized into seven categories.

### Issue Events (5)

| Event | Fired When |
|-------|------------|
| `issue.created` | A new issue is created |
| `issue.updated` | Issue fields are modified (includes `changes` diff) |
| `issue.assigned` | Issue assignee changes (includes old/new assignee IDs) |
| `issue.state_changed` | Issue state transitions (includes old/new state) |
| `issue.deleted` | An issue is deleted |

### Comment Events (3)

| Event | Fired When |
|-------|------------|
| `comment.created` | A comment is added to an issue (includes `mentions` array) |
| `comment.updated` | A comment is edited |
| `comment.deleted` | A comment is deleted |

### Label Events (2)

| Event | Fired When |
|-------|------------|
| `label.added` | A label is attached to an issue |
| `label.removed` | A label is removed from an issue |

### Sprint Events (2)

| Event | Fired When |
|-------|------------|
| `sprint.started` | A sprint status changes to active |
| `sprint.completed` | A sprint is marked as completed |

### Project and Member Events (5)

| Event | Fired When |
|-------|------------|
| `project.created` | A new project is created |
| `project.updated` | Project fields are modified |
| `project.deleted` | A project is deleted |
| `member.added` | A user is added to the workspace |
| `member.removed` | A user is removed from the workspace |

### Governance Events (9)

| Event | Fired When |
|-------|------------|
| `proposal.created` | A new proposal is drafted |
| `proposal.updated` | Proposal fields are modified |
| `proposal.deleted` | A proposal is deleted |
| `proposal.submitted` | A proposal is submitted for review |
| `proposal.voting_started` | Voting opens on a proposal |
| `proposal.archived` | A proposal is archived |
| `proposal.vote_cast` | A vote is cast on a proposal |
| `veto.exercised` | A vetoer exercises their veto right |
| `veto.withdrawn` | A veto is withdrawn |

### Escalation and Appeal Events (2)

| Event | Fired When |
|-------|------------|
| `escalation.started` | An escalation process begins |
| `appeal.created` | An appeal is filed against a decision |

### Configuration Events (1)

| Event | Fired When |
|-------|------------|
| `governance_config.updated` | Governance configuration is changed |

### AI Task Events (2)

| Event | Fired When |
|-------|------------|
| `ai.task_completed` | An AI task finishes successfully |
| `ai.task_failed` | An AI task fails after exhausting retries |

## Webhook Configuration

Webhooks are configured per workspace via the API. Each webhook specifies:

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | HTTPS endpoint to receive events |
| `secret` | string | Shared secret for HMAC-SHA256 signing |
| `events` | JSONB | Array of event types to subscribe to |
| `active` | boolean | Enable or disable the webhook |
| `bot_user_id` | UUID (optional) | If set, enables bot context enrichment for AI task dispatch |

When `bot_user_id` is set and the event involves an issue assigned to that bot, the payload includes a `bot_context` object with agent dispatch information.

## Payload Structure

Every webhook delivery includes these HTTP headers:

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `User-Agent` | `OpenPR-Webhook/1.0` |
| `X-Webhook-Signature` | `sha256=<hex-encoded HMAC>` |
| `X-Webhook-Event` | Event type (e.g., `issue.created`) |
| `X-Webhook-Delivery` | Unique delivery UUID |

### Payload Body

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

### Bot Context

The `bot_context` field is present only when:

1. The webhook has a `bot_user_id` configured, AND
2. The issue is assigned to that bot user, OR
3. The bot is `@mentioned` in a comment

The `trigger_reason` field indicates why the bot was triggered:

| Reason | When |
|--------|------|
| `created` | Issue was created with bot as assignee |
| `assigned` | Issue was assigned or updated with bot as assignee |
| `status_changed` | Issue state transitioned |
| `mentioned` | Bot was `@mentioned` in a comment |
| `completed` | AI task completed |
| `failed` | AI task failed |

### Event-Specific Data

For `issue.updated`, `issue.assigned`, and `issue.state_changed` events, the `data` object includes a `changes` field showing what changed:

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

For `comment.created` events, the `data` includes a `mentions` array of user UUIDs:

```json
{
  "data": {
    "comment": { "..." : "..." },
    "issue": { "..." : "..." },
    "mentions": ["user-uuid-1", "user-uuid-2"]
  }
}
```

## Signature Verification

To verify a webhook delivery, compute the HMAC-SHA256 of the raw request body using your webhook secret and compare it to the signature in the `X-Webhook-Signature` header.

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

## Delivery Records

Every webhook delivery is persisted in the `webhook_deliveries` table with:

- Delivery UUID
- Webhook ID
- Event type
- Full payload (JSONB)
- Request headers
- Response status code
- Response body
- Error message (if delivery failed)
- Duration in milliseconds
- Success flag
- Timestamp

The webhook's `last_triggered_at` timestamp is updated after each delivery attempt.

## Delivery Behavior

- **Timeout**: 10 seconds per delivery attempt
- **No automatic retries**: Failed deliveries are recorded but not retried (the AI task system has its own retry mechanism)
- **Async dispatch**: Webhooks are triggered in a background Tokio task and do not block the API response
- **Best-effort**: If payload construction fails, the error is recorded and the webhook is skipped

## Related

- [OpenPR Overview](/docs/plan/overview/) -- Architecture and quick start
- [AI Tasks](/docs/plan/ai-tasks/) -- How webhooks drive AI task dispatch
- [Governance](/docs/plan/governance/) -- Governance events and configuration
- [Architecture Overview](/docs/getting-started/architecture/) -- Full pipeline communication
