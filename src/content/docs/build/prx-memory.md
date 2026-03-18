---
title: prx-memory
description: "Persistent knowledge store for AI agents, exposed as an MCP server with hybrid retrieval and self-evolution."
sidebar:
  order: 3
---

prx-memory is a Rust MCP server that gives AI agents persistent, searchable memory. Agents store learnings during task execution and recall them in future sessions, enabling knowledge accumulation across the entire pipeline.

## Transports

prx-memory supports two MCP transports:

| Transport | Use Case |
|-----------|----------|
| **stdio** | Direct integration with CLI agents (claude-code, codex) |
| **HTTP** | Network-accessible server for multi-agent deployments (requires `--features http`) |

## MCP Tools

prx-memory exposes 14 MCP tools:

### Core Operations

| Tool | Description |
|------|-------------|
| `store` | Store a new memory entry with content, tags, and importance score |
| `recall` | Retrieve memories by semantic similarity, keyword match, or tag filter |
| `update` | Modify an existing memory's content, tags, or importance |
| `forget` | Soft-delete a memory (recoverable) |
| `list` | List memories with pagination and filtering |
| `stats` | Return memory store statistics (count, tag distribution, storage size) |

### Bulk Operations

| Tool | Description |
|------|-------------|
| `store_dual` | Store a memory with both a concise summary and full content |
| `export` | Export all memories to JSON for backup or migration |
| `import` | Import memories from a JSON export |
| `migrate` | Migrate memory store schema to a new version |

### Advanced Operations

| Tool | Description |
|------|-------------|
| `reembed` | Regenerate embeddings for all memories (after switching embedding provider) |
| `compact` | Merge duplicate or near-duplicate memories to reduce store size |
| `evolve` | Trigger MSES self-evolution cycle (see below) |
| `skill_manifest` | Return a structured manifest of all tools and their parameters |

## Hybrid Retrieval

When an agent calls `recall`, prx-memory runs a multi-signal retrieval pipeline:

```
Query
  │
  ├── BM25 keyword search (sparse)
  ├── Cosine similarity on embeddings (dense)
  │
  ▼
Score fusion
  │
  ├── Recency boost (newer memories score higher)
  ├── Importance weighting (user-assigned importance)
  ├── Deduplication (near-duplicate suppression)
  │
  ▼
Optional reranking
  │
  ▼
Top-K results
```

### Reranking Providers

When enabled, retrieved candidates are reranked by a dedicated model for higher precision:

| Provider | Notes |
|----------|-------|
| Jina Reranker | Jina AI reranking API |
| Cohere Rerank | Cohere's reranking endpoint |
| Pinecone Rerank | Pinecone's inference API |

Reranking is optional and disabled by default. Enable it when recall precision is more important than latency.

## Embedding Providers

prx-memory generates vector embeddings for semantic search. Supported providers:

| Provider | Models | Notes |
|----------|--------|-------|
| OpenAI-compatible | `text-embedding-3-small`, `text-embedding-3-large`, or any compatible endpoint | Default; works with OpenAI, Azure, local servers |
| Jina | `jina-embeddings-v3` | Jina AI's embedding API |
| Gemini | `text-embedding-004` | Google's embedding model |

Configure the provider and model in the configuration file. If you switch providers, run the `reembed` tool to regenerate all existing embeddings.

## Self-Evolution (MSES)

The Memory Self-Evolution System (MSES) optimizes retrieval parameters automatically:

1. **Candidate selection** -- Choose a parameter to evolve (e.g., BM25 weight, recency decay, similarity threshold)
2. **Train set scoring** -- Evaluate candidates against a training set of known-good query/result pairs
3. **Holdout scoring** -- Validate the best candidate against a held-out test set to prevent overfitting
4. **Apply or reject** -- If the holdout score improves, the new parameter is adopted; otherwise, the current value is retained

Trigger evolution manually via the `evolve` MCP tool, or configure it to run on a schedule.

## Governance

prx-memory includes governance controls for multi-agent and multi-team deployments:

### Standardization Profiles

Define naming conventions and content standards that all stored memories must follow. Memories that violate the active profile are rejected or auto-corrected.

### Tag Taxonomy

Enforce a controlled vocabulary for memory tags. Free-form tags can be mapped to canonical tags automatically.

### Ratio Bounds

Set minimum and maximum ratios for memory categories (e.g., "at least 10% of memories must be error patterns", "no more than 50% can be code snippets"). This prevents the store from becoming dominated by a single category.

### Scope ACL

Control which agents or users can read/write specific memory scopes. Scopes partition the memory store so that project-specific knowledge does not leak across boundaries.

## Configuration

```toml
[storage]
path = "~/.prx-memory/store.db"

[embedding]
provider = "openai"
model = "text-embedding-3-small"
api_key_env = "OPENAI_API_KEY"

[retrieval]
bm25_weight = 0.3
semantic_weight = 0.7
recency_half_life_days = 30
top_k = 10

[reranker]
enabled = false
provider = "jina"

[evolution]
enabled = false
schedule = "weekly"
```

## Running

```bash
# stdio mode (for direct agent integration)
cargo run --release

# HTTP mode (network-accessible)
cargo run --release --features http

# With custom config
cargo run --release -- --config /etc/prx-memory/config.toml
```
