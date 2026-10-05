---
title: "Build: Agent Pipeline"
description: How AI agents are dispatched to work on tasks and how knowledge persists across sessions.
sidebar:
  order: 1
---

The Build stage connects project management (Plan) to actual code generation. When an issue is assigned to a bot in Sylvode, the Build layer dispatches an AI coding agent, manages its execution, and feeds results back into the project.

## Key Components

| Component | Role | Language |
|-----------|------|----------|
| [Sylvode Webhook](/build/webhook-dispatcher/) | Receives Sylvode events, dispatches AI agents | Rust (Axum) |
| [prx-memory](/build/prx-memory/) | Persistent knowledge store for agents (MCP server) | Rust |

## Data Flow

```
Sylvode event (issue.created / issue.updated)
    │
    ▼
Sylvode Webhook (HMAC-SHA256 verified)
    │
    ├── Filter: is this a bot task?
    │
    ▼
CLI Executor
    │
    ├── Launch agent (codex, claude-code, opencode)
    ├── Inject prompt from template
    ├── Set working directory, timeout (900s)
    │
    ▼
AI Agent works
    │
    ├── Reads code, makes changes, runs tests
    ├── Stores/recalls knowledge via prx-memory (MCP)
    │
    ▼
Callback (MCP / API)
    │
    ├── Post results to Sylvode
    ├── State transition: in_progress → done
    │
    ▼
Sylvode updates issue
```

## How It Fits in the Pipeline

The Build stage sits between Think (AI reasoning) and Ship (distribution):

1. **Plan** creates a task and assigns it to a bot user
2. **Think** provides model routing and sub-agent orchestration
3. **Build** dispatches the coding agent and persists learned patterns
4. **Ship** distributes the resulting artifacts
5. **Protect** defends the deployed application

## Agent Lifecycle

A single agent session follows this lifecycle:

1. **Trigger** -- Sylvode fires a webhook event (e.g., `issue.created` with a bot assignee)
2. **Dispatch** -- Sylvode Webhook matches the event to an agent configuration and launches the CLI executor
3. **Execution** -- The agent operates within a sandboxed working directory with a strict timeout
4. **Memory** -- During execution, the agent calls prx-memory MCP tools to recall past solutions and store new learnings
5. **Report** -- The agent posts its results (code changes, test outcomes, error logs) back to Sylvode
6. **Close** -- Sylvode transitions the issue state based on the result

## Getting Started

```bash
# Clone and build the webhook dispatcher
git clone https://github.com/openprx/openpr-webhook
cd openpr-webhook && cargo build --release

# Clone and run prx-memory
git clone https://github.com/openprx/prx-memory
cd prx-memory && cargo run --release --features http
```

Configure the webhook dispatcher with your Sylvode instance URL, webhook secret, and agent settings. See the individual component docs for configuration details.
