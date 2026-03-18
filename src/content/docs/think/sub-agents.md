---
title: Sub-agents
description: PRX delegates work through a three-tier system — synchronous named agents, async fire-and-forget sessions, and management commands — plus MCP client and remote nodes.
sidebar:
  order: 5
---

PRX is not a single-threaded conversational agent. It delegates work through a structured hierarchy of sub-agents, each with different execution models, lifetime guarantees, and supervision levels.

## Three-Tier Delegation

### Tier 1: Delegate (Synchronous)

The `delegate` command dispatches a task to a **named agent** and waits for the result before continuing. This is synchronous, blocking delegation.

```
PRX main ──delegate("coder", task)──→ Agent "coder"
            │                            │
            │ (blocked, waiting)         │ (working...)
            │                            │
            ◀── result ─────────────────┘
```

**Key properties:**

- **Named agents** — each agent has a name, a system prompt, and optionally a dedicated model
- **Agentic mode** — the delegated agent runs a full tool loop (observe, think, act, repeat) until the task is complete
- **Depth control** — delegation depth is limited (default: 3 levels) to prevent infinite recursion. Agent A can delegate to Agent B, who can delegate to Agent C, but C cannot delegate further
- **Context isolation** — each delegated agent has its own conversation context; it does not see the parent's full history, only the task description

```toml
[agents.coder]
system_prompt = "You are a coding agent. Write clean, tested code."
model = "anthropic/claude-sonnet-4-20250514"
tools = ["read_file", "write_file", "bash", "grep"]
max_depth = 3
```

### Tier 2: Sessions Spawn (Async Fire-and-Forget)

The `sessions_spawn` command launches an agent asynchronously. The parent does not wait — it receives a **run ID** immediately and continues processing.

```
PRX main ──sessions_spawn(task)──→ returns run_id="abc123"
            │                          │
            │ (continues working)      │ Spawned session (running independently)
            │                          │
            │                          └──→ On completion: auto-announce result
```

**Key properties:**

- **Fire-and-forget** — the caller gets a run ID and moves on
- **Auto-announce** — when the spawned session completes, it announces its result back to the originating channel
- **Steer** — the parent (or user) can send follow-up instructions to a running session using its run ID
- **Kill** — a running session can be terminated by its run ID

This is useful for long-running tasks: "go research this topic and report back when done" while the main agent continues answering other questions.

### Tier 3: Subagents Management

Management commands for inspecting and controlling running sub-agents:

| Command | Description |
|---------|-------------|
| `subagents list` | List all active sub-agent sessions with their run IDs, status, and elapsed time |
| `subagents kill <run_id>` | Terminate a running sub-agent session |
| `subagents steer <run_id> <instruction>` | Send a follow-up instruction to a running session, redirecting its behavior |

This gives operators visibility and control over autonomous work happening in the background.

## MCP Client

PRX includes a built-in **MCP (Model Context Protocol) client** for connecting to external MCP servers and consuming their tools.

```toml
[mcp_servers.memory]
transport = "http"
url = "http://localhost:8082/mcp"

[mcp_servers.filesystem]
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
```

**Supported transports:**

| Transport | Description |
|-----------|-------------|
| HTTP | Connects to an MCP server via HTTP/SSE |
| stdio | Launches a subprocess and communicates via stdin/stdout |

When an MCP server is configured, its tools become available to PRX and all sub-agents. Tool calls are routed through the MCP client transparently — the LLM sees them as native tools.

This is how PRX connects to:
- **prx-memory** for persistent knowledge storage and retrieval
- **OpenPR** for project management operations (create issues, update status)
- **File system servers** for sandboxed file access
- Any third-party MCP-compatible server

## Remote Nodes

PRX supports distributed execution through **remote nodes** (`prx-node`), allowing work to be delegated to other machines.

### Architecture

```
PRX Daemon (central)
  │
  ├── H2 transport ──→ prx-node (server A)
  ├── H2 transport ──→ prx-node (laptop B)
  └── H2 transport ──→ prx-node (GPU server C)
```

### Device Pairing

Remote nodes authenticate via a pairing protocol:

1. The remote node generates a pairing code
2. The operator enters the pairing code on the central PRX instance
3. A shared secret is established for future communication
4. All subsequent traffic is encrypted over H2 (HTTP/2)

### Use Cases

- **GPU offloading** — route inference to a machine with a GPU running Ollama or vLLM
- **Platform-specific tasks** — delegate macOS tasks to a Mac node, Windows tasks to a Windows node
- **Geographic distribution** — run nodes in different regions to reduce latency to local services
- **Isolation** — run untrusted tool execution on a dedicated node with limited access

```toml
[remote_nodes.gpu_server]
address = "192.168.1.100:9090"
paired = true
capabilities = ["gpu", "ollama"]
```

Sub-agents can be explicitly routed to remote nodes, or the Router can consider node capabilities when making delegation decisions.
