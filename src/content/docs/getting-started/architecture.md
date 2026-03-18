---
title: Architecture Overview
description: How OpenPRX components connect to form an AI-autonomous engineering pipeline.
sidebar:
  order: 2
---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenPR (Plan)                             │
│  Issues · Boards · Sprints · Governance · MCP · Webhooks     │
└──────────┬──────────────────────────────────┬───────────────┘
           │ Task dispatch                     │ Result callback
           ▼                                   ▲
┌──────────────────────┐              ┌────────────────────┐
│  openpr-webhook      │              │  AI Agent           │
│  Event routing       │── dispatch ──│  Codex / Claude /   │
│  WSS tunnel          │              │  OpenCode           │
└──────────┬───────────┘              └────────┬───────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────────────────────────────────────────┐
│                      PRX (Think)                          │
│  19 Channels · 14 Providers · Router · Sub-agents         │
│  Self-Evolution · Security Policy · MCP Client            │
└──────────┬──────────┬──────────┬──────────┬──────────────┘
           │          │          │          │
           ▼          ▼          ▼          ▼
      prx-memory  prx-email   Fenfa    WAF + SD
      (Build)     (Build)    (Ship)   (Protect)
```

## Communication Protocols

### MCP (Model Context Protocol)

The primary integration protocol. OpenPR exposes 34 MCP tools via HTTP, stdio, and SSE transports. PRX connects as an MCP client.

### Webhooks

OpenPR fires 30 event types via HMAC-SHA256 signed webhooks. The openpr-webhook service receives these events and dispatches work to AI agents.

### WSS Tunnel

For agents behind NAT/firewalls, openpr-webhook supports an outbound WebSocket tunnel to the OpenPR control plane. Tasks are received, acknowledged, executed, and results returned through the tunnel.

## Data Flow

### Issue → Fix → Deploy

1. **Issue created** in OpenPR (manually or via API)
2. **Bot task assigned** — OpenPR fires `issue.created` webhook with bot context
3. **Webhook dispatcher** receives the event, matches it to an agent configuration
4. **CLI executor** launches the coding agent (e.g., `claude-code`) with a templated prompt
5. **Agent works** — reads code, makes changes, runs tests
6. **Agent uses prx-memory** via MCP to recall past patterns and store new learnings
7. **Result callback** — agent posts results back to OpenPR via MCP/API
8. **State transition** — issue moves from `in_progress` to `done`
9. **CI builds** — standard CI/CD pipeline produces artifacts
10. **Fenfa distributes** — build artifacts uploaded via API, distributed to all platforms

### Security Loop

1. **WAF monitors** incoming HTTP traffic through 17 detection phases
2. **SD scans** files on endpoints with hash matching, YARA rules, and ML inference
3. **Threats detected** → automated response (block, quarantine, remediation)
4. **Notifications** sent via webhook, email, Telegram
5. **Future**: Security events feed back into OpenPR as issues for AI-driven response

## Deployment Topology

### Minimal (Single Machine)

```
┌─────────────────────────┐
│  Server                  │
│  ├── OpenPR (Docker)     │
│  ├── PRX (binary)        │
│  ├── prx-memory (binary) │
│  └── PostgreSQL          │
└─────────────────────────┘
```

### Production

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ OpenPR   │  │ PRX      │  │ Fenfa    │
│ + Caddy  │  │ daemon   │  │ + S3/R2  │
└────┬─────┘  └────┬─────┘  └──────────┘
     │             │
     ▼             ▼
┌──────────┐  ┌──────────┐
│ WAF      │  │ SD       │
│ cluster  │  │ daemon   │
└──────────┘  └──────────┘
```
