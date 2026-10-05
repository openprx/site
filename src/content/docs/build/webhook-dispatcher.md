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
| `openclaw` | Send a notification through the OpenClaw CLI (Signal, Telegram) |
| `openprx` | Send a notification through the OpenPRX Signal API or CLI |
| `webhook` | Forward events to an external HTTP endpoint |
| `custom` | Run a user-defined command |
| `cli` | Run a whitelisted coding agent locally |

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
| Prompt template | `Fix issue {issue_id}: {title}` | Template with placeholders for issue context |

### Prompt Templates

`prompt_template` supports placeholders that are filled from the webhook event payload: `{issue_id}`, `{title}`, `{reason}`, `{event}`, `{project_id}`, `{form_id}`, `{form_key}` and `{record_id}`.

```toml
prompt_template = "Fix issue {issue_id}: {title}\nContext: {reason}"
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

The riskier paths sit behind feature gates in the `[features]` section, all defaulting to **false**:

| Feature | Default | Description |
|---------|---------|-------------|
| `cli_enabled` | `false` | Enable local CLI agent execution |
| `tunnel_enabled` | `false` | Enable the WSS tunnel connection (also needs `[tunnel].enabled = true`) |
| `callback_enabled` | `false` | Enable result callbacks to Sylvode |

### Safe Mode

Setting the environment variable `SYLVODE_WEBHOOK_SAFE_MODE=1` (also `true`, `yes` or `on`) forces the CLI, tunnel and callback paths off at runtime, whatever the configuration file says. It is a one-switch rollback to webhook-only behavior: events are still verified and forwarded to notification agents, but no coding agent is launched. The legacy name `OPENPR_WEBHOOK_SAFE_MODE` is still read, with a deprecation notice, and is not removed before v2.0.

### Executor Whitelist

The strict CLI whitelist (`codex`, `claude-code`, `opencode`) prevents arbitrary command execution. The whitelist is compiled into the binary and cannot be modified at runtime through configuration alone.

## Configuration

```toml
[server]
listen = "0.0.0.0:9090"

[security]
webhook_secrets = ["your-hmac-secret"]

[features]
cli_enabled = true

[[agents]]
id = "ai-fixer"
name = "AI Issue Fixer"
agent_type = "cli"

[agents.cli]
executor = "claude-code" # codex | claude-code | opencode
workdir = "/opt/repos/my-project"
timeout_secs = 900
prompt_template = "Fix issue {issue_id}: {title}\nContext: {reason}"
```

The full reference is `config.example.toml` in the [repository](https://github.com/openprx/openpr-webhook).

## Running

```bash
# Build (inside the openpr-webhook repository checkout)
cargo build --release

# Run with config.toml from the working directory
./target/release/sylvode-webhook

# Run with an explicit config path
./target/release/sylvode-webhook /etc/sylvode-webhook/config.toml
```

The configuration path is a positional argument; `--help` and `--version` print usage and the version. Release archives and the container image `ghcr.io/openprx/sylvode-webhook` ship the same executable. The legacy executable name `openpr-webhook` still works and prints a deprecation notice; the legacy image name `ghcr.io/openprx/openpr-webhook` is published with the same digest. Neither is removed before v2.0.
