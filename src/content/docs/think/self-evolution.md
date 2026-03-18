---
title: Self-Evolution
description: PRX autonomously improves its own prompts, memory, and strategies through a Record-Analyze-Evolve pipeline with safety gates and automatic rollback.
sidebar:
  order: 6
---

The self-evolution system is 9,806 lines of Rust across 22 modules. It enables PRX to improve its own behavior over time — not by retraining models, but by evolving the prompts, memory structures, and operational strategies that surround them.

## Pipeline

Self-evolution operates on a three-phase cycle:

```
Record (realtime)
  │  Every request/response pair is logged with metadata
  │
  ▼
Analyze (daily)
  │  Patterns extracted: failure modes, slow paths, cost outliers
  │
  ▼
Evolve (every 3 days)
     Generate candidate improvements, test in shadow mode, promote or rollback
```

### Record Phase (Realtime)

Every interaction is recorded with:

- Request content and classified intent
- Selected model and routing score breakdown
- Response content and latency
- Outcome signals: user acceptance, retries, follow-up corrections, tool call success/failure
- Token counts and estimated cost

This data accumulates in a local store, building the evidence base for analysis.

### Analyze Phase (Daily)

A daily analysis job processes recent records to identify:

| Pattern | Detection Method |
|---------|-----------------|
| Repeated failures on a task type | Cluster failed requests by intent + model |
| Prompt weaknesses | Identify where system prompts lead to off-target responses |
| Cost inefficiencies | Flag requests where a cheaper model would have sufficed |
| Latency outliers | Detect models or tools with degrading performance |
| Memory gaps | Find topics where the agent lacks stored knowledge |

Analysis results are stored as structured findings, each tagged with severity and actionable recommendations.

### Evolve Phase (Every 3 Days)

Based on accumulated analysis findings, the evolution engine generates **candidate changes**:

## Three Evolution Layers

### Prompt Evolution

Modifies system prompts to address identified weaknesses:

- Rewrites instructions that led to misinterpretations
- Adds or refines few-shot examples based on real failure cases
- Adjusts tone, verbosity, or formatting directives
- Tunes tool-use instructions when tool calls are failing

### Memory Evolution

Improves the knowledge stored in prx-memory:

- Extracts reusable patterns from successful interactions
- Consolidates fragmented knowledge entries
- Deprecates outdated or contradictory memories
- Indexes new domain knowledge discovered during operation

### Strategy Evolution

Adjusts operational parameters:

- Router scoring weights (alpha, beta, gamma, delta, epsilon)
- Automix confidence thresholds
- Concurrency limits per channel
- Timeout budgets
- Default model preferences per intent category

## Safety System

Self-evolution is powerful but dangerous. PRX enforces multiple safety layers to prevent regressions.

### Gate Checks

Before any candidate change is applied, it must pass gate checks:

1. **Syntax validation** — the change must produce valid configuration/prompts
2. **Regression test** — replay a sample of recent successful interactions with the proposed change and verify outputs remain acceptable
3. **Scope check** — the change must not exceed its permitted scope (e.g., a prompt evolution cannot modify security policy)

### Shadow Mode

Candidate changes are first deployed in **shadow mode**:

- The current (production) configuration handles all real requests
- The candidate configuration runs in parallel on the same inputs
- Outputs are compared but the candidate's responses are never sent to users
- Metrics are collected: quality delta, latency delta, cost delta

Shadow mode runs for a configurable evaluation period (default: 24 hours).

### Judge Model

A separate **judge model** evaluates shadow mode results. It compares production vs. candidate outputs across a sample of requests and scores the candidate on a 0-1 scale.

- **Threshold: 0.6** — candidates scoring below 0.6 are rejected
- The judge model is typically a strong reasoning model (e.g., Claude Opus, o3) different from the models being evaluated
- Judge prompts are themselves versioned and not subject to self-evolution (to prevent gaming)

### Circuit Breaker

If a promoted change causes a spike in failures after deployment:

1. The circuit breaker triggers when the failure rate exceeds 2x the baseline within a 1-hour window
2. The change is automatically rolled back
3. An incident record is created with the failure evidence
4. The change is marked as failed and will not be retried without modification

### Version Snapshots

Every configuration state is versioned:

```
v1.0  ── initial config
v1.1  ── prompt evolution: improved coding instructions
v1.2  ── strategy evolution: adjusted router weights
v1.3  ── ROLLED BACK (circuit breaker triggered)
v1.2  ── restored (current)
```

Snapshots include the full prompt set, memory state hash, router weights, and all configuration parameters. Any version can be restored instantly.

### Experiment Tracking

All evolution attempts are tracked with:

| Field | Description |
|-------|-------------|
| Candidate ID | Unique identifier for the proposed change |
| Layer | prompt / memory / strategy |
| Trigger | Analysis finding that motivated the change |
| Shadow metrics | Quality, latency, cost deltas observed |
| Judge score | Score from the judge model |
| Outcome | promoted / rejected / rolled_back |
| Duration | Time the change was active before rollback (if applicable) |

This provides a complete audit trail of how and why the system changed over time.

## RollbackManager

The `RollbackManager` handles automatic and manual rollbacks:

- **Automatic** — triggered by the circuit breaker when failure rates spike
- **Manual** — operators can roll back to any previous version via CLI or API
- **Selective** — roll back only one layer (e.g., revert prompt changes but keep strategy changes)

```bash
# List evolution history
prx evolution history

# Roll back to a specific version
prx evolution rollback v1.2

# Roll back only prompt changes
prx evolution rollback --layer prompt v1.1
```

Rollbacks are instantaneous because all version snapshots are retained locally.
