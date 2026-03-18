---
title: "Protect: Security"
description: Two complementary security products for network defense and endpoint protection.
sidebar:
  order: 1
---

The Protect stage defends deployed applications and infrastructure with two complementary products:

| Product | Domain | What it protects |
|---------|--------|-----------------|
| [PRX-WAF](/docs/protect/prx-waf/) | Network | HTTP/HTTPS traffic -- blocks attacks before they reach your application |
| [PRX-SD](/docs/protect/prx-sd/) | Endpoint | Files and processes -- detects and removes malware on hosts |

## Defense in Depth

PRX-WAF and PRX-SD cover different layers of the security stack:

```
Internet traffic
    │
    ▼
┌─────────────────────────────┐
│  PRX-WAF (Network Layer)     │
│  17-phase detection pipeline │
│  SQLi · XSS · RCE · DDoS    │
│  Bot detection · GeoIP       │
└──────────────┬──────────────┘
               │ Clean traffic
               ▼
┌─────────────────────────────┐
│  Application Server          │
│  Files written to disk       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  PRX-SD (Endpoint Layer)     │
│  Hash matching · YARA rules  │
│  Heuristic analysis · ML     │
│  Real-time file monitoring   │
└─────────────────────────────┘
```

## Automated Response

Both products support automated response actions:

| Product | Actions |
|---------|---------|
| PRX-WAF | Block request, redirect, log-only, rate limit, CrowdSec report |
| PRX-SD | Quarantine file, kill process, clean persistence mechanisms, network isolation |

## Notification System

Both products push alerts through multiple channels:

| Channel | PRX-WAF | PRX-SD |
|---------|---------|--------|
| Webhook (JSON) | Yes | Yes |
| Slack | Yes | Yes |
| Discord | Yes | Yes |
| Telegram | Yes | -- |
| Email | Yes | -- |

## The Vision: Security Feedback Loop

In the full OpenPRX pipeline, security events feed back into the development cycle:

1. **PRX-WAF** detects a new attack pattern against your API
2. A security event is created as an issue in **OpenPR**
3. An AI agent is dispatched via **openpr-webhook** to analyze the vulnerability
4. The agent patches the code and pushes a fix
5. **Fenfa** distributes the updated build
6. **PRX-WAF** and **PRX-SD** rules are updated to cover the new pattern

This closes the loop from detection to remediation without manual intervention.

## Tech Stack

Both products are built in Rust for performance and memory safety:

| Product | Architecture | Crates |
|---------|-------------|--------|
| PRX-WAF | 7-crate workspace on Cloudflare Pingora | Core, rules, detection, admin, notification, cluster, CLI |
| PRX-SD | 11-crate workspace | Core, scanner, signatures, YARA, heuristics, ML, quarantine, sandbox, monitor, CLI, GUI (Tauri) |
