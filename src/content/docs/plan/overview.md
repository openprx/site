---
title: "OpenPR: AI-Native Project Management"
description: "Overview of OpenPR — the Plan stage of the OpenPRX pipeline. Issues, boards, sprints, governance, MCP server, webhooks, and AI task dispatch."
sidebar:
  order: 1
---

OpenPR is the **Plan** stage of the [OpenPRX pipeline](/docs/getting-started/overview/). It is a project management platform purpose-built for teams where AI agents work alongside humans. Unlike traditional issue trackers, OpenPR treats AI agents as first-class participants with their own authentication, task queues, governance roles, and callback APIs.

## Position in the Pipeline

```
Plan  -->  Think  -->  Build  -->  Ship  -->  Protect
 ^
 OpenPR
```

OpenPR is the origin point. Issues created here flow downstream through the rest of the pipeline: [PRX](/docs/think/overview/) selects the right AI model, the agent writes code, [Fenfa](/docs/ship/overview/) distributes the artifact, and [WAF + SD](/docs/protect/overview/) defends the deployed application.

## Key Features

### Issue Tracking and Boards

Work items (issues) support the full lifecycle with four states:

| State | Meaning |
|-------|---------|
| `backlog` | Not yet scheduled |
| `todo` | Planned for current or next sprint |
| `in_progress` | Actively being worked on |
| `done` | Completed |

Each issue carries a priority (`low`, `medium`, `high`, `urgent`), optional labels, assignees (human or bot), and a sprint association. Issues are scoped to projects, and projects belong to workspaces.

### Sprints

Time-boxed iterations with start and end dates. Sprints can be created, updated, started, and completed. When a sprint starts or completes, webhook events are fired for downstream automation.

### Governance

A full governance module enables structured decision-making with human oversight of AI operations. See the dedicated [governance documentation](/docs/plan/governance/) for details on proposals, voting, veto rights, trust scores, and impact reviews.

### AI Task System

Issues can be assigned to bot users and dispatched as structured tasks to AI coding agents (Codex, Claude Code, OpenCode). The worker process polls pending tasks, dispatches them via webhook, and the agent reports results back through the API. See [AI Tasks](/docs/plan/ai-tasks/) for the full workflow.

### MCP Server

OpenPR exposes 34 tools via the Model Context Protocol (MCP), allowing AI agents to manage projects, issues, sprints, labels, proposals, and more through a standardized interface. See [MCP Server](/docs/plan/mcp-server/) for the complete tool catalog.

### Webhooks

30 event types are fired via HMAC-SHA256 signed HTTP webhooks covering issues, comments, labels, sprints, proposals, governance, and AI task lifecycle. See [Webhooks](/docs/plan/webhooks/) for event types and payload structure.

### Notifications

In-app notification system for workspace members. Notifications are generated for issue assignments, comment mentions, proposal updates, and governance actions.

### Pages

A built-in document/page system for project documentation, meeting notes, and knowledge base content.

## Architecture

OpenPR consists of five services:

| Service | Port | Role |
|---------|------|------|
| **api** | 8080 | REST API server (Axum) |
| **worker** | -- | Background task dispatcher (polls `ai_tasks` table) |
| **mcp-server** | 8090 | MCP protocol server (HTTP, stdio, SSE) |
| **frontend** | 80 | Web UI (SvelteKit, served via nginx) |
| **postgres** | 5432 | PostgreSQL 16 database |

An optional **webhook** service handles outbound event routing and WSS tunnel support for agents behind NAT.

```
Frontend (nginx :3000) --> API (:8080) <-- MCP Server (:8090)
                              |
                         PostgreSQL (:5432)
                              |
                         Worker (background)
```

## Database

OpenPR uses PostgreSQL 16 with 38 tables organized into three groups:

**Core project management** -- `users`, `workspaces`, `workspace_members`, `projects`, `work_items`, `comments`, `activities`, `labels`, `work_item_labels`, `sprints`

**Governance** -- `proposals`, `proposal_templates`, `proposal_comments`, `proposal_issue_links`, `votes`, `decisions`, `decision_domains`, `decision_audit_reports`, `governance_configs`, `governance_audit_logs`, `vetoers`, `veto_events`, `appeals`, `trust_scores`, `trust_score_logs`, `impact_reviews`, `impact_metrics`, `review_participants`, `feedback_loop_links`

**Infrastructure** -- `notifications`, `webhooks`, `webhook_deliveries`, `pages`, `job_queue`, `scheduled_jobs`, `cache_entries`, `ai_learning_records`, `ai_participants`

Migrations are numbered `0001` through `0019` and are applied automatically on first startup via the PostgreSQL `docker-entrypoint-initdb.d` mechanism.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Deploy with Docker Compose

```bash
git clone https://github.com/openprx/openpr
cd openpr

# Set a production JWT secret
export JWT_SECRET="your-secure-random-string"

# Start all services
docker compose up -d
```

This starts PostgreSQL, runs migrations, and brings up the API, worker, MCP server, and frontend.

### Access

| Endpoint | URL |
|----------|-----|
| Web UI | `http://localhost:3000` |
| REST API | `http://localhost:8081` |
| MCP Server | `http://localhost:8090` |

The first user to register automatically becomes the workspace admin.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `change-me-in-production` | Secret for signing JWT tokens |
| `JWT_ACCESS_TTL_SECONDS` | `2592000` (30 days) | Access token lifetime |
| `JWT_REFRESH_TTL_SECONDS` | `2592000` (30 days) | Refresh token lifetime |
| `DATABASE_URL` | (set in compose) | PostgreSQL connection string |
| `RUST_LOG` | `info` | Log level filter |
| `UPLOAD_DIR` | `/app/uploads` | File upload storage directory |

### Production Deployment

For production, place a reverse proxy (Caddy, nginx) in front of the frontend:

```
# Example Caddy configuration
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy automatically provisions TLS certificates via Let's Encrypt.

## User Model

OpenPR distinguishes two entity types:

| Entity Type | Description |
|-------------|-------------|
| `human` | Regular user with email/password authentication |
| `bot` | AI agent with bot token authentication (`opr_` prefix) |

Both types can be assigned to issues, participate in governance, and interact through the API. Bot users authenticate with workspace-scoped bot tokens rather than JWT credentials.

## What's Next

- [MCP Server](/docs/plan/mcp-server/) -- 34 tools for AI agent integration
- [Webhooks](/docs/plan/webhooks/) -- 30 event types and payload structure
- [AI Tasks](/docs/plan/ai-tasks/) -- Task dispatch and agent callback workflow
- [Governance](/docs/plan/governance/) -- Proposals, voting, veto rights, and trust scores
