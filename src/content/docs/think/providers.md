---
title: Providers
description: PRX integrates 14 LLM providers through a unified Provider trait with tool-calling abstraction, automatic retries, and fallback chains.
sidebar:
  order: 3
---

PRX supports **14 LLM providers**, each implementing a common `Provider` trait. The trait abstracts away differences in API formats, authentication, streaming, and tool calling, presenting a uniform interface to the Router and the rest of the system.

## Supported Providers

| Provider | Models | Auth | Notes |
|----------|--------|------|-------|
| Anthropic | Claude Opus, Sonnet, Haiku | API key, OAuth (auto-refresh) | Primary provider; OAuth token refresh is automatic |
| OpenAI | GPT-4o, GPT-4.1, o1, o3, o4-mini | API key | Full function calling support |
| OpenAI Codex | codex-mini | API key | Code-specialized; tool use via Responses API |
| Google Gemini | Gemini 2.5 Pro/Flash | API key | Native function calling |
| DashScope / Qwen | Qwen-Max, Qwen-Plus, Qwen-Turbo | API key | Alibaba Cloud; compatible API |
| Ollama | Any GGUF model | Local (no key) | Local inference; no tool calling |
| OpenRouter | Any model on OpenRouter | API key | Aggregator; routing across 100+ models |
| AWS Bedrock | Claude, Titan, Llama | IAM credentials | SigV4 signing; enterprise deployment |
| GitHub Copilot | GPT-4o, Claude | Copilot token | Reuses VS Code / CLI Copilot auth |
| GLM / Zhipu | GLM-4, GLM-4V | API key | Chinese market; vision support |
| xAI | Grok | API key | OpenAI-compatible API |
| LiteLLM | Any model behind LiteLLM proxy | API key or local | Unified proxy; useful for custom deployments |
| vLLM | Any model served by vLLM | Local endpoint | High-throughput local inference |
| HuggingFace | Inference API models | API token | HuggingFace Inference Endpoints |

## Tool Calling Abstraction

LLM providers differ in how they handle tool/function calling. PRX normalizes this through two modes:

### Native Tool Calling

Providers that support structured tool calling natively (Anthropic, OpenAI, Google Gemini, etc.) receive tool definitions as part of the API request. The provider returns structured tool-use blocks that PRX parses and executes directly.

### PromptGuided Tool Calling

For providers without native tool support (Ollama, some vLLM models), PRX injects tool definitions into the system prompt along with instructions for the model to emit tool calls in a structured text format. PRX then parses the model output to extract tool invocations.

```
┌──────────────────────────────────┐
│         Tool Call Flow           │
│                                  │
│  Tools defined ──┬── Native ──── Provider API (structured)
│                  │
│                  └── PromptGuided ── System prompt injection
│                                      ── Output parsing
└──────────────────────────────────┘
```

This abstraction means every provider can participate in agentic tool loops, regardless of native support.

## ReliableProvider Wrapper

Every provider is wrapped in a `ReliableProvider` that adds resilience:

### Automatic Retries

Failed requests are retried with exponential backoff. The wrapper classifies errors to determine retry behavior:

| Error Class | Retry | Behavior |
|-------------|-------|----------|
| Rate limited (429) | Yes | Respects `Retry-After` header; exponential backoff |
| Server error (5xx) | Yes | Up to 3 retries with jitter |
| Auth error (401/403) | No | Fails immediately; triggers token refresh for OAuth providers |
| Timeout | Yes | Retries with extended timeout |
| Context length exceeded | No | Fails immediately; caller should truncate |

### Provider Fallback Chains

When a provider is exhausted (all retries failed), the `ReliableProvider` falls back to the next provider in a configured chain:

```toml
[router.fallback]
chain = ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o", "google/gemini-2.5-pro"]
```

The Router tries each provider/model pair in order. If the primary is down or rate-limited, the request transparently moves to the next option.

### Model Fallback

Within a single provider, model-level fallback is also supported:

```toml
[providers.anthropic]
models = ["claude-sonnet-4-20250514", "claude-haiku-4-20250414"]
fallback_order = ["claude-sonnet-4-20250514", "claude-haiku-4-20250414"]
```

If the preferred model is unavailable, PRX downgrades to the next model at the same provider before attempting a cross-provider fallback.

## Configuration

```toml
[providers.anthropic]
enabled = true
api_key = "sk-ant-..."
# Or use OAuth (token auto-refreshes)
# oauth_client_id = "..."
# oauth_client_secret = "..."
default_model = "claude-sonnet-4-20250514"

[providers.openai]
enabled = true
api_key = "sk-..."
default_model = "gpt-4o"

[providers.ollama]
enabled = true
base_url = "http://localhost:11434"
default_model = "llama3.1:70b"
tool_mode = "prompt_guided"   # No native tool calling
```

Each provider entry specifies credentials, a default model, and optional overrides for tool calling mode, timeout, and retry limits.
