---
title: "Sylvode: AI-Native Project Management"
description: "Overview of Sylvode — the Plan stage of the OpenPRX pipeline. Issues, boards, sprints, governance, MCP server, webhooks, and AI task dispatch."
sidebar:
  order: 1
---

> Sylvode was formerly named OpenPR. Existing deployments keep working; only the product name changed.

Sylvode is the **Plan** stage of the [OpenPRX pipeline](/getting-started/overview/). It is a project management platform purpose-built for teams where AI agents work alongside humans. Unlike traditional issue trackers, Sylvode treats AI agents as first-class participants with their own authentication, task queues, governance roles, and callback APIs.

## Position in the Pipeline

```
Plan  -->  Think  -->  Build  -->  Ship  -->  Protect
 ^
 Sylvode
```

Sylvode is the origin point. Issues created here flow downstream through the rest of the pipeline: [PRX](/think/overview/) selects the right AI model, the agent writes code, [Fenfa](/ship/overview/) distributes the artifact, and [WAF + SD](/protect/overview/) defends the deployed application.

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

A full governance module enables structured decision-making with human oversight of AI operations. See the dedicated [governance documentation](/plan/governance/) for details on proposals, voting, veto rights, trust scores, and impact reviews.

### AI Task System

Issues can be assigned to bot users and dispatched as structured tasks to AI coding agents (Codex, Claude Code, OpenCode). The worker process polls pending tasks, dispatches them via webhook, and the agent reports results back through the API. See [AI Tasks](/plan/ai-tasks/) for the full workflow.

### MCP Server

Sylvode exposes 140 tools via the Model Context Protocol (MCP), allowing AI agents to manage projects, issues, sprints, labels, proposals, and more through a standardized interface. See [MCP Server](/plan/mcp-server/) for the complete tool catalog.

### Webhooks

Workspace webhooks deliver HMAC-SHA256 signed HTTP requests. A webhook can subscribe to exactly 14 events: `issue.created`, `issue.updated`, `issue.assigned`, `issue.deleted`, `issue.state_changed`, `comment.created`, `comment.updated`, `comment.deleted`, `label.added`, `label.removed`, `sprint.started`, `sprint.completed`, `ai.task_completed` and `ai.task_failed`. The API refuses any other event name when a webhook is created or updated. See [Webhooks](/plan/webhooks/) for the payload structure.

### Notifications

In-app notification system for workspace members. Notifications are generated for issue assignments, comment mentions, proposal updates, and governance actions.

### Pages

A built-in document/page system for project documentation, meeting notes, and knowledge base content.

## Architecture

Sylvode consists of five services, defined in the bundled `docker-compose.yml`:

| Service | Port | Role |
|---------|------|------|
| **api** | 8080 in the container, published on host port 8081 | REST API server (Axum) |
| **worker** | -- | Background pipelines (AI task dispatch, governance settlement, form jobs) |
| **mcp-server** | 8090 | MCP protocol server (HTTP, stdio, SSE) |
| **frontend** | 80 in the container, published on host port 3000 | Web UI (SvelteKit, served via nginx, proxies `/api` to the API) |
| **postgres** | 5432, compose network only | PostgreSQL 16 database |

An optional **webhook** service handles outbound event routing and WSS tunnel support for agents behind NAT.

```
Frontend (host :3000) --> API (host :8081, container :8080) <-- MCP Server (:8090)
                              |
                         PostgreSQL (compose network)
                              |
                         Worker (background)
```

## Database

Sylvode uses PostgreSQL 16. The migrations are numbered `0000` through `0069`; applied in order they create 101 tables. Among them:

**Core project management** -- `users`, `workspaces`, `workspace_members`, `projects`, `work_items`, `comments`, `activities`, `labels`, `work_item_labels`, `sprints`

**Governance** -- `proposals`, `proposal_templates`, `proposal_comments`, `proposal_issue_links`, `votes`, `decisions`, `decision_domains`, `decision_audit_reports`, `governance_configs`, `governance_audit_logs`, `vetoers`, `veto_events`, `appeals`, `trust_scores`, `trust_score_logs`, `impact_reviews`, `impact_metrics`, `review_participants`, `feedback_loop_links`

**Infrastructure** -- `notifications`, `webhooks`, `webhook_deliveries`, `pages`, `job_queue`, `scheduled_jobs`, `cache_entries`, `ai_learning_records`, `ai_participants`

The remaining tables belong to universal forms, plugins, workflows, project types, the event ledger and Flow. The migrations are compiled into the API, which applies any missing ones when it starts; on the first start of an empty volume the PostgreSQL image also runs them through `docker-entrypoint-initdb.d`.

## Quick Start

### Prerequisites

- Docker with the `docker compose` plugin, or Podman
- Git
- A Rust toolchain and Python 3.11+ (`scripts/start.sh` builds the binaries on the host and validates the generated configuration)

### Deploy with Docker Compose

```bash
git clone https://github.com/openprx/sylvode
cd sylvode

# Generate the configuration, build the binaries and start all services
bash scripts/start.sh
```

On first run `scripts/start.sh` writes `config/sylvode.compose.toml` (API and worker) and `config/sylvode.compose.mcp.toml` (MCP server) with random bootstrap secrets, plus a compose-only `.env`, then builds the release binaries and runs `docker compose up -d --build`.

### Access

| Endpoint | URL |
|----------|-----|
| Web UI | `http://localhost:3000` |
| REST API | `http://localhost:8081` |
| MCP Server | `http://localhost:8090` |

The web UI has no sign-up page. While no user exists, `POST /api/v1/auth/register` creates the first account, which becomes the system administrator; later accounts are created by an administrator.

### Configuration

The `api`, `worker` and `mcp-server` binaries read no environment variables. Every setting comes from one TOML file, named with `--config` and defaulting to `config/sylvode.toml`:

| Key | Default | Description |
|-----|---------|-------------|
| `database.url` | required (API, worker) | PostgreSQL connection URL |
| `auth.jwt_secret` | required (API, worker) | JWT signing secret, at least 16 characters |
| `auth.access_ttl_seconds` | `1296000` (15 days) | Access token lifetime |
| `auth.refresh_ttl_seconds` | `1728000` (20 days) | Refresh token lifetime |
| `server.bind_addr` | `0.0.0.0:8081` (API) | Listen address |
| `logging.filter` | `<service>=info,tower_http=info` | Log filter (replaces `RUST_LOG`) |
| `storage.dir` | `./uploads` | Upload directory of the local storage backend |
| `mcp.api_url`, `mcp.bot_token`, `mcp.workspace_id` | `http://localhost:8081`, none, required | MCP server settings |

Only compose-level `SYLVODE_*` variables (bind host, published ports, runtime image) are read, by `docker compose` and `scripts/start.sh`. See the [configuration reference](https://docs.openprx.dev/en/sylvode/configuration/) for every key.

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

Sylvode distinguishes two entity types:

| Entity Type | Description |
|-------------|-------------|
| `human` | Regular user with email/password authentication |
| `bot` | AI agent with bot token authentication (`opr_` prefix) |

Both types can be assigned to issues, participate in governance, and interact through the API. Bot users authenticate with workspace-scoped bot tokens rather than JWT credentials.

## What's Next

- [MCP Server](/plan/mcp-server/) -- 140 tools for AI agent integration
- [Webhooks](/plan/webhooks/) -- The 14 subscribable events and the payload structure
- [AI Tasks](/plan/ai-tasks/) -- Task dispatch and agent callback workflow
- [Governance](/plan/governance/) -- Proposals, voting, veto rights, and trust scores
