---
title: What is PRX?
description: PRX is a self-evolving AI orchestration daemon — the brain of the OpenPRX pipeline, routing messages across 19 channels and 14 LLM providers.
sidebar:
  order: 1
---

PRX is a persistent AI orchestration daemon written in 169K lines of Rust. It is not a wrapper around a single LLM. It is a continuously running process that receives messages from 19 channels, routes them through an intelligent model selector, delegates work to sub-agents, and evolves its own behavior over time.

## Role in the Pipeline

In the OpenPRX pipeline (`Plan -> Think -> Build -> Ship -> Protect`), PRX occupies the **Think** stage. It is the central nervous system: every AI-driven decision flows through PRX.

```
OpenPR (Plan)                          Fenfa (Ship)
    │                                      ▲
    ▼                                      │
  PRX ── sub-agents ── prx-memory ── CI ───┘
    │
    ▼
  WAF + SD (Protect)
```

OpenPR dispatches tasks. PRX decides which model handles them, manages conversation history, enforces security policy, and delegates subtasks to autonomous sub-agents. Results flow back to OpenPR and downstream stages.

## Key Subsystems

| Subsystem | Purpose |
|-----------|---------|
| [Channels](/docs/think/channels/) | 19 messaging integrations (Signal, WhatsApp, Telegram, Discord, Slack, Matrix, etc.) |
| [Providers](/docs/think/providers/) | 14 LLM backends with unified tool-calling abstraction |
| [Router](/docs/think/router/) | Intelligent model selection: intent classification, Elo rating, KNN semantic routing, Automix |
| [Sub-agents](/docs/think/sub-agents/) | Three-tier delegation: synchronous named agents, async fire-and-forget sessions, management commands |
| [Self-evolution](/docs/think/self-evolution/) | Autonomous improvement of prompts, memory, and strategies with safety gates |
| [Security](/docs/think/security/) | 5-layer policy pipeline, approval workflows, sandbox enforcement (Docker, Firejail, Bubblewrap, Landlock, WASM) |
| Plugins | WASM-based plugin system with wasmtime sandboxing |
| MCP Client | Connects to external MCP servers to consume tools |
| Remote Nodes | Distributed execution via `prx-node` with H2 transport and device pairing |

## How It Works

1. A message arrives on any channel (Telegram, Signal, CLI, webhook, etc.)
2. PRX maintains per-sender conversation history (last 50 messages) with automatic compaction
3. The Router classifies intent, scores candidate models, and selects the best provider
4. The selected LLM generates a response, potentially invoking tools
5. If the task requires delegation, sub-agents are spawned (sync or async)
6. The self-evolution system records outcomes for periodic analysis and improvement
7. Security policy is enforced at every layer: command execution, file access, cost limits

## Quick Start

```bash
# Clone and build
git clone https://github.com/openprx/prx && cd prx
cargo build --release

# Configure at least one provider and one channel
cp config.example.toml config.toml
# Edit config.toml: set your API keys and channel credentials

# Run the daemon
./target/release/prx --config config.toml

# Or use the CLI channel for immediate interaction
./target/release/prx --cli
```

PRX reads its configuration from a TOML file. At minimum, you need one provider (e.g., Anthropic with an API key) and one channel (e.g., CLI for local testing). See the subsystem pages for detailed configuration.
