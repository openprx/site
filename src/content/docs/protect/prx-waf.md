---
title: PRX-WAF
description: "A 17-phase web application firewall built on Cloudflare Pingora with multi-format rule support and real-time notifications."
sidebar:
  order: 2
---

PRX-WAF is a web application firewall built as a 7-crate Rust workspace on top of Cloudflare's Pingora proxy framework. It inspects HTTP traffic through a 17-phase detection pipeline and supports YAML, ModSecurity, and JSON rule formats.

## Architecture

PRX-WAF is organized as a Rust workspace with seven crates:

| Crate | Role |
|-------|------|
| `prx-waf-core` | Pingora integration, request/response lifecycle, phase orchestration |
| `prx-waf-rules` | Rule parsing (YAML, ModSecurity, JSON), rule engine |
| `prx-waf-detection` | Detection logic for all 17 phases |
| `prx-waf-admin` | Vue 3 admin dashboard and management API |
| `prx-waf-notification` | Alert delivery (webhook, Telegram, email) |
| `prx-waf-cluster` | QUIC-based cluster synchronization |
| `prx-waf-cli` | Command-line interface |

## 17-Phase Detection Pipeline

Every HTTP request passes through these phases in order. A match at any phase can terminate processing with a configured action.

| Phase | Name | Description |
|-------|------|-------------|
| 1 | IP Whitelist | Allow requests from trusted IPs (bypass all subsequent phases) |
| 2 | IP Blacklist | Block requests from known-bad IPs |
| 3 | URL Whitelist | Allow requests to trusted URL paths |
| 4 | URL Blacklist | Block requests to forbidden URL paths |
| 5 | CC/DDoS | Rate limiting and connection flood detection |
| 6 | Scanner Detection | Identify automated vulnerability scanners (Nikto, sqlmap, etc.) |
| 7 | Bot Detection | Distinguish bots from humans (fingerprinting, challenge) |
| 8 | SQL Injection | Detect SQLi payloads in parameters, headers, and body |
| 9 | XSS | Detect cross-site scripting payloads |
| 10 | RCE | Detect remote code execution attempts (command injection, SSRF) |
| 11 | Directory Traversal | Detect path traversal attempts (`../`, encoded variants) |
| 12 | Custom Rules (Rhai) | User-defined detection logic written in Rhai scripting language |
| 13 | OWASP CRS | Compatibility layer for OWASP Core Rule Set |
| 14 | Sensitive Data | Detect sensitive data in responses (credit cards, SSNs, API keys) |
| 15 | Anti-Hotlinking | Prevent unauthorized embedding of your resources |
| 16 | CrowdSec | Integration with CrowdSec community blocklists |
| 17 | GeoIP | Block or allow traffic by country/region |

## Rule Formats

PRX-WAF supports three rule formats, allowing teams to use their preferred syntax or import existing rule sets:

### YAML Rules

```yaml
- id: sql-injection-union
  phase: 8
  description: "Detect UNION-based SQL injection"
  match:
    field: args
    pattern: "(?i)union\\s+(all\\s+)?select"
  action: block
  severity: critical
```

### ModSecurity Rules

```
SecRule ARGS "@rx (?i)union\s+(all\s+)?select" \
  "id:1001,phase:2,deny,status:403,msg:'SQL Injection'"
```

### JSON Rules

```json
{
  "id": "xss-script-tag",
  "phase": 9,
  "match": {"field": "args", "pattern": "<script[^>]*>"},
  "action": "block"
}
```

PRX-WAF ships with **50+ rule files** covering common attack patterns across all detection phases.

## Response Actions

When a rule matches, PRX-WAF can take one of these actions:

| Action | Description |
|--------|-------------|
| `block` | Return a 403 response and terminate the request |
| `allow` | Explicitly allow the request (skip remaining phases) |
| `log` | Log the match but allow the request to continue |
| `redirect` | Redirect the client to a specified URL |

Actions are configured per rule and can be overridden by global policy.

## Notification System

PRX-WAF pushes real-time alerts when threats are detected:

| Channel | Configuration |
|---------|---------------|
| Webhook | HTTP POST with JSON payload to any endpoint |
| Telegram | Bot API with chat ID |
| Email | SMTP with configurable sender/recipient |

Notifications include the matched rule, request details (IP, URL, headers), severity, and the action taken.

## Real-Time Streams

PRX-WAF supports **WebSocket real-time streams** for live monitoring:

- Live request log with detection results
- Attack frequency metrics
- Top blocked IPs and attack types

The admin dashboard connects to these streams for a real-time security overview.

## QUIC Cluster

For multi-node deployments, PRX-WAF nodes synchronize state over **QUIC**:

- Shared IP blocklists and rate-limit counters
- Rule updates propagated across nodes
- Consistent GeoIP and CrowdSec data

## Admin Dashboard

The Vue 3 admin dashboard provides:

- Real-time traffic and threat visualization
- Rule management (create, edit, enable/disable)
- IP whitelist/blacklist management
- Detection phase configuration
- Notification channel setup
- Cluster node status

## Running

```bash
# Build all crates
cargo build --release

# Run with config
./target/release/prx-waf --config /etc/prx-waf/config.yaml

# CLI: test a rule against a sample request
./target/release/prx-waf-cli test-rule --rule rules/sqli.yaml --request sample.http
```
