---
title: Webhook Dispatcher
description: "Sylvode Webhook: the Rust service that receives Sylvode events and dispatches AI coding agents."
sidebar:
  order: 2
---

Sylvode Webhook is a Rust service built on Axum that bridges Sylvode's project management events with AI coding agents. It receives webhook events, verifies their authenticity, and launches the appropriate agent to work on the task.

## Architecture

```
Sylvode ──webhook──▶ Sylvode Webhook ──CLI──▶ AI Agent
                         │                      │
                         │◀─────callback─────────┘
                         │
                    WSS tunnel (optional, for NAT traversal)
```

## Webhook Endpoint

The service exposes an HTTP endpoint that receives Sylvode webhook events. Every incoming request is verified using **HMAC-SHA256** signature validation against a shared secret configured between Sylvode and the dispatcher.

Supported event types include `issue.created`, `issue.updated`, and other Sylvode lifecycle events. The dispatcher filters these to identify **bot tasks** -- events where the assignee is a bot user -- and ignores human-only assignments.

## Agent Types

The dispatcher supports five agent types:

| Agent Type | Description |
|------------|-------------|
| `openclaw` | The OpenPRX default coding agent |
| `openprx` | General-purpose OpenPRX agent |
| `webhook` | Forward events to an external webhook |
| `custom` | User-defined agent with custom configuration |
| `cli` | CLI-based agent executed locally |

## CLI Executor

The CLI executor is the primary dispatch mechanism. It launches a coding agent as a subprocess with controlled parameters.

### Whitelisted CLIs

Only the following CLI tools are allowed:

| CLI | Description |
|-----|-------------|
| `codex` | OpenAI Codex CLI agent |
| `claude-code` | Anthropic Claude Code CLI agent |
| `opencode` | Open-source coding agent |

Any attempt to execute a binary not on this whitelist is rejected.

### Execution Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Working directory | Configured per agent | The repository checkout path |
| Timeout | 900s (15 min) | Maximum execution time before forceful termination |
| Prompt template | Per agent type | Template with placeholders for issue context |

### Prompt Templates

Prompt templates support placeholders that are filled from the webhook event payload:

```
You are working on project {{project_name}}.
Issue #{{issue_number}}: {{issue_title}}

Description:
{{issue_description}}

Please implement the required changes and report your results.
```

## Callback Loop

After an agent completes its work, results are posted back to Sylvode through either:

- **MCP** -- The agent calls Sylvode's MCP tools directly to update issue state, add comments, and transition status
- **API** -- Direct REST API calls to Sylvode's HTTP endpoints

The callback updates the issue with the agent's output and transitions its state (typically `in_progress` to `done` on success, or adding a comment with error details on failure).

## WSS Tunnel

For deployments where the agent host sits behind NAT or a firewall, Sylvode Webhook supports an outbound **WebSocket Secure (WSS) tunnel** to the Sylvode control plane.

The tunnel flow:

1. Sylvode Webhook opens an outbound WSS connection to Sylvode
2. Sylvode pushes task events through the tunnel
3. The dispatcher acknowledges receipt, executes the agent locally
4. Results are returned through the same tunnel connection

This avoids the need for inbound port forwarding or public IP addresses on the agent host.

## Safety Controls

Sylvode Webhook is designed with defense-in-depth:

### Feature Gates

All capabilities are behind feature gates that default to **false**:

| Feature | Default | Description |
|---------|---------|-------------|
| `cli_executor` | `false` | Enable local CLI agent execution |
| `wss_tunnel` | `false` | Enable WSS tunnel connection |
| `webhook_forward` | `false` | Enable forwarding to external webhooks |
| `custom_agent` | `false` | Enable custom agent configurations |

### Safe Mode

When safe mode is enabled, the dispatcher operates in a read-only observation mode: events are received and logged but no agents are dispatched. This is useful for testing webhook connectivity and validating event payloads before enabling execution.

### Executor Whitelist

The strict CLI whitelist (`codex`, `claude-code`, `opencode`) prevents arbitrary command execution. The whitelist is compiled into the binary and cannot be modified at runtime through configuration alone.

## Configuration

```toml
[webhook]
secret = "your-hmac-secret"
listen = "0.0.0.0:8091"

[executor]
working_dir = "/opt/repos"
timeout_secs = 900
safe_mode = false

[agents.default]
type = "cli"
cli = "claude-code"
prompt_template = "default.txt"
```

## Running

```bash
# Build
cargo build --release

# Run with default config
./target/release/openpr-webhook

# Run with custom config path
./target/release/openpr-webhook --config /etc/openpr-webhook/config.toml
```
