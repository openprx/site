---
title: Security Policy
description: PRX enforces a 5-layer security policy pipeline with autonomy levels, approval workflows, and sandboxed execution via Docker, Firejail, Bubblewrap, Landlock, and WASM.
sidebar:
  order: 7
---

Security in PRX is not an afterthought bolted onto the agent loop. It is a structural component — a 5-layer policy pipeline that governs what every agent, tool, and plugin is allowed to do.

## SecurityPolicy Struct

The core policy is defined by the `SecurityPolicy` struct:

```rust
pub struct SecurityPolicy {
    pub autonomy: AutonomyLevel,
    pub workspace_restrictions: Vec<PathBuf>,
    pub allowed_commands: Vec<String>,
    pub forbidden_paths: Vec<PathBuf>,
    pub rate_limits: RateLimits,
    pub cost_limits: CostLimits,
}
```

### Autonomy Levels

| Level | Behavior |
|-------|----------|
| `ReadOnly` | Agent can read files and call LLMs but cannot execute commands, write files, or modify state |
| `Supervised` | Agent can propose actions but must receive human approval before execution |
| `Full` | Agent can execute actions autonomously within policy bounds |

### Workspace Restrictions

Limits the file system paths an agent can access:

```toml
workspace_restrictions = ["/home/user/project", "/tmp/workspace"]
```

Any file operation outside these paths is denied, regardless of autonomy level.

### Allowed Commands

An explicit allowlist of shell commands the agent may execute:

```toml
allowed_commands = ["git", "cargo", "npm", "python", "ls", "cat", "grep"]
```

Commands not on this list are blocked. Wildcards are not supported — every permitted command must be listed explicitly.

### Forbidden Paths

Paths that are always denied, even if they fall within a permitted workspace:

```toml
forbidden_paths = ["/home/user/project/.env", "/home/user/project/secrets/"]
```

### Rate Limits

Controls request frequency:

```toml
[rate_limits]
requests_per_minute = 60
requests_per_hour = 500
max_concurrent = 4
```

### Cost Limits

Caps spending on LLM API calls:

```toml
[cost_limits]
max_per_request_usd = 1.00
max_per_hour_usd = 10.00
max_per_day_usd = 50.00
```

When a cost limit is reached, further LLM calls are blocked until the window resets.

## 5-Layer Policy Pipeline

Policies are evaluated in a layered hierarchy. Each layer can restrict (but never expand) the permissions granted by the layer above.

```
┌──────────────────────────────┐
│  Layer 1: Global Policy      │  System-wide defaults
├──────────────────────────────┤
│  Layer 2: Profile Policy     │  Per-user or per-role overrides
├──────────────────────────────┤
│  Layer 3: Agent Policy       │  Per-named-agent restrictions
├──────────────────────────────┤
│  Layer 4: Group Policy       │  Per-channel-group restrictions
├──────────────────────────────┤
│  Layer 5: Tool Policy        │  Per-tool restrictions
└──────────────────────────────┘
```

| Layer | Scope | Example |
|-------|-------|---------|
| Global | All agents, all channels | `autonomy = Supervised`, `max_per_day_usd = 100` |
| Profile | Specific user or role | Admin profile gets `autonomy = Full`; guest profile stays `ReadOnly` |
| Agent | Named agent (e.g., "coder") | Coder agent gets `allowed_commands = ["git", "cargo"]`, research agent gets none |
| Group | Channel group (e.g., a specific Telegram group) | Public groups forced to `ReadOnly` |
| Tool | Individual tool (e.g., "bash") | Bash tool gets extra `forbidden_paths`, tighter `rate_limits` |

The effective policy for any action is the **intersection** of all applicable layers. If any layer denies an action, it is denied.

## Approval Workflow

When `autonomy = Supervised`, the agent cannot execute actions directly. Instead:

1. Agent proposes an action (e.g., "run `cargo test`")
2. PRX formats the proposal and sends it to the supervising channel
3. The supervisor (human) reviews and responds: approve, deny, or modify
4. If approved, PRX executes the action and returns the result to the agent
5. If denied, the agent receives a denial message and must find an alternative approach

Approval requests include:
- The exact command or action proposed
- The agent name and context
- The security policy layer that requires approval
- A timeout (default: 5 minutes) after which the action is auto-denied

## Sandboxing

PRX supports multiple sandboxing backends for isolating tool execution. The sandbox is selected based on platform availability and configuration.

### Docker

Full container isolation. Commands run inside a disposable Docker container with:
- Mounted workspace directory (read-only or read-write per policy)
- No network access (unless explicitly allowed)
- Resource limits (CPU, memory, time)
- Dropped capabilities

```toml
[sandbox]
backend = "docker"
image = "prx-sandbox:latest"
network = false
memory_limit = "512m"
cpu_limit = "1.0"
timeout_seconds = 300
```

### Firejail

Lightweight Linux sandboxing using namespaces and seccomp:
- File system whitelisting
- Network filtering
- Seccomp syscall filtering
- No root required

```toml
[sandbox]
backend = "firejail"
whitelist = ["/home/user/project"]
net = "none"
```

### Bubblewrap (bwrap)

Minimal unprivileged sandboxing used by Flatpak:
- Mount namespace isolation
- PID namespace isolation
- Bind-mount only specified directories
- Drop all capabilities

```toml
[sandbox]
backend = "bubblewrap"
bind_rw = ["/home/user/project"]
bind_ro = ["/usr", "/lib", "/bin"]
unshare_net = true
```

### Landlock

Linux Security Module for fine-grained file system access control:
- Restricts file access at the kernel level
- No container overhead
- Works with unprivileged processes
- Available on Linux 5.13+

```toml
[sandbox]
backend = "landlock"
allowed_read = ["/home/user/project", "/usr/lib"]
allowed_write = ["/home/user/project/output"]
```

### Sandbox Selection

PRX auto-detects available backends and selects the strongest available:

```
Docker > Bubblewrap > Firejail > Landlock > None
```

If no sandbox backend is available and the policy requires sandboxing, tool execution is denied.

## WASM Plugin Sandboxing

PRX plugins are compiled to WASM and executed in a **wasmtime** sandbox:

- Memory isolation: each plugin gets its own linear memory
- No file system access unless explicitly granted via WASI
- No network access unless explicitly granted
- CPU time limits enforced by wasmtime fuel metering
- Plugins cannot access PRX internals — they communicate through a defined host API

```toml
[plugins.my_plugin]
path = "plugins/my_plugin.wasm"
permissions = ["fs:read:/data", "net:https://api.example.com"]
fuel_limit = 1_000_000
```

This ensures that third-party or user-authored plugins cannot compromise the host system, leak data, or consume unbounded resources.
