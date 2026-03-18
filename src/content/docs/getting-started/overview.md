---
title: What is OpenPRX?
description: An introduction to the OpenPRX AI-autonomous software engineering infrastructure.
sidebar:
  order: 1
---

OpenPRX is an open-source infrastructure stack where AI agents autonomously manage the full software lifecycle — from project planning to code generation to distribution to security defense.

## The Pipeline

OpenPRX is organized as a five-stage pipeline:

```
Plan → Think → Build → Ship → Protect
```

| Stage | Product | What it does |
|-------|---------|-------------|
| **Plan** | [OpenPR](/docs/plan/overview/) | AI-native project management with MCP, webhooks, governance |
| **Think** | [PRX](/docs/think/overview/) | AI orchestration brain — 14 providers, intelligent routing, self-evolution |
| **Build** | [Webhook + Memory](/docs/build/overview/) | Agent dispatch, code execution, knowledge persistence |
| **Ship** | [Fenfa](/docs/ship/overview/) | Multi-platform app distribution with upload API |
| **Protect** | [WAF + SD](/docs/protect/overview/) | 17-phase web defense + ML-powered antivirus |

## How It's Different

**Traditional AI tools** (Copilot, Cursor) assist one developer at a time. They help you type faster.

**OpenPRX** runs entire workflows autonomously:

1. An issue is created in OpenPR
2. OpenPR dispatches the task to an AI coding agent via webhook
3. PRX selects the right model, delegates to sub-agents
4. The agent writes code, commits, and reports back
5. CI builds the artifact, Fenfa distributes it
6. WAF and SD protect the deployed application
7. Security events feed back into OpenPR as new issues

Humans govern — setting policies, reviewing proposals, voting on decisions. AI operates within those boundaries.

## Key Numbers

| Metric | Value |
|--------|-------|
| Total Rust code | 170K+ lines |
| Messaging channels | 19 (Signal, WhatsApp, Telegram, Discord, Slack...) |
| LLM providers | 14 (Anthropic, OpenAI, Google, Ollama...) |
| MCP tools | 34 |
| Security rules | 38,800+ YARA rules |
| WAF detection phases | 17 |
| Self-evolution system | 9,800 lines |

## Tech Stack

All core products are built with **Rust** for performance and reliability. The stack includes:

- **Rust** — Core runtime for PRX, OpenPR, WAF, SD, Memory, Webhook
- **Go** — Fenfa distribution platform
- **PostgreSQL** — OpenPR and WAF persistence
- **SQLite** — Memory, SD signatures (LMDB), Email
- **Vue 3 + Tauri** — Desktop GUI for PRX-SD
- **SvelteKit** — OpenPR frontend

## Getting Started

Pick the component you need, or deploy the full stack:

```bash
# Start with project management
git clone https://github.com/openprx/openpr && cd openpr
docker compose up -d

# Add the AI brain
git clone https://github.com/openprx/prx && cd prx
cargo run --release

# Add persistent memory for agents
git clone https://github.com/openprx/prx-memory && cd prx-memory
cargo run --features http
```

See each product's documentation for detailed setup instructions.
