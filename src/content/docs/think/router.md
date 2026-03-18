---
title: LLM Router
description: The Router intelligently selects the optimal LLM for each request using intent classification, capability matching, Elo ratings, semantic similarity, and cost-aware scoring.
sidebar:
  order: 4
---

The LLM Router is PRX's model selection engine — 2,808 lines of Rust that decide which provider and model handles each incoming request. It balances quality, cost, latency, and capability to make optimal routing decisions in real time.

## Routing Flow

```
Incoming Request
  │
  ├─ 1. Intent Classification
  │     Categorize the request (code, chat, analysis, translation, etc.)
  │
  ├─ 2. Model Selection (Scorer)
  │     Score all candidate models and rank them
  │
  ├─ 3. Reliability Fallback
  │     If selected model is unavailable, fall through the chain
  │
  ├─ 4. Automix
  │     Start with a cheaper model; upgrade if confidence is low
  │
  └─ 5. Record Outcome
        Log result for Elo updates and future routing decisions
```

## Scoring Formula

Each candidate model receives a composite score:

```
score = alpha * similarity
      + beta  * capability
      + gamma * elo
      - delta * cost
      - epsilon * latency
```

| Factor | Weight | Source |
|--------|--------|--------|
| `similarity` | `alpha` | KNN semantic distance between request and model's best-performing past requests |
| `capability` | `beta` | Static capability matrix (coding, math, reasoning, multilingual, vision, etc.) |
| `elo` | `gamma` | Dynamic Elo rating updated after each completed request |
| `cost` | `delta` | Per-token price (input + output) |
| `latency` | `epsilon` | Rolling average response time for this model |

Weights are configurable and can be tuned per channel or per user to prioritize quality over cost or vice versa.

## Components

### Intent Classification

The classifier maps each request to one or more intent categories:

| Intent | Description | Preferred Capabilities |
|--------|-------------|----------------------|
| `code` | Write, debug, or review code | Strong coding benchmarks |
| `chat` | Casual conversation | Low latency, cheap |
| `analysis` | Data analysis, complex reasoning | High reasoning capability |
| `translation` | Language translation | Multilingual strength |
| `vision` | Image understanding | Vision model required |
| `math` | Mathematical problem solving | Math/reasoning benchmarks |
| `creative` | Writing, brainstorming | Creative fluency |
| `tool_use` | Agentic workflows with tool calls | Native tool calling, instruction following |

Classification is fast — it uses keyword heuristics and a lightweight model call when ambiguous.

### Capability Matching

Each model has a static capability profile that rates it across dimensions:

```
claude-sonnet-4:   coding=0.95  reasoning=0.93  creative=0.90  speed=0.80  cost=0.70
gpt-4o:          coding=0.90  reasoning=0.88  creative=0.85  speed=0.85  cost=0.75
gemini-2.5-pro:  coding=0.88  reasoning=0.90  creative=0.82  speed=0.82  cost=0.80
llama3.1-70b:    coding=0.75  reasoning=0.70  creative=0.72  speed=0.90  cost=0.95
```

The Router multiplies the intent-relevant capability scores by `beta` to produce the capability component of the final score.

### Elo Rating

Every model maintains an Elo rating that updates after each request. When a request succeeds (user accepts the response, no retry needed), the model gains Elo. When a request fails or is retried on a different model, the model loses Elo.

This creates a self-correcting feedback loop: models that perform well in practice rise in ranking, regardless of their static benchmarks.

### KNN Semantic Routing

The Router maintains an embedding index of past requests and their outcomes. For each new request, it finds the K nearest past requests (by embedding similarity) and checks which models performed best on similar inputs.

This is especially valuable for specialized domains — if a particular model consistently handles SQL questions well in your environment, the Router learns to prefer it for SQL-related requests.

### Automix

Automix is a cost optimization strategy:

1. Route the request to a **cheaper model** first (e.g., Haiku, GPT-4o-mini)
2. Evaluate the response confidence (based on model self-assessment, response coherence, and output quality signals)
3. If confidence falls below a threshold, **re-route to a premium model** (e.g., Opus, o3)
4. Return the premium response to the user

This saves cost on simple requests while maintaining quality on hard ones. The confidence threshold is tunable.

```
Request ──→ Cheap Model ──→ Confidence Check
                              │
                    ≥ threshold → Return cheap response
                    < threshold → Re-route to premium model
                                  → Return premium response
```

### History

The Router logs every routing decision and its outcome:

- Which model was selected and why (score breakdown)
- Whether the request succeeded or was retried
- Response latency and token counts
- User feedback signals (if available)

This history feeds the Elo system, the KNN index, and provides observability into routing behavior.

## Cold-Start Guards

When PRX starts fresh with no history, the Router falls back to sensible defaults:

- Elo ratings initialize to 1500 for all models
- KNN index is empty, so `similarity` contributes zero to the score
- Capability matching and cost/latency become the dominant factors
- A configurable `default_model` is used when scores are tied

As the system accumulates history, the dynamic components (Elo, KNN) gradually take over from static heuristics.

## Configuration

```toml
[router]
default_model = "anthropic/claude-sonnet-4-20250514"

# Scoring weights
alpha = 0.25    # Semantic similarity
beta  = 0.30    # Capability match
gamma = 0.20    # Elo rating
delta = 0.15    # Cost penalty
epsilon = 0.10  # Latency penalty

# Automix
automix_enabled = true
automix_cheap_model = "anthropic/claude-haiku-4-20250414"
automix_premium_model = "anthropic/claude-sonnet-4-20250514"
automix_confidence_threshold = 0.7

# Fallback chain
fallback_chain = [
  "anthropic/claude-sonnet-4-20250514",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
]
```
