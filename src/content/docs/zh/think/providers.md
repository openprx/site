---
title: 供应商
description: PRX 通过统一的 Provider trait 集成 14 个 LLM 供应商，支持工具调用抽象、自动重试和降级链。
sidebar:
  order: 3
---

PRX 支持 **14 个 LLM 供应商**，每个都实现了通用的 `Provider` trait。该 trait 抽象了 API 格式、认证、流式传输和工具调用的差异，为路由器和系统其余部分提供统一接口。

## 支持的供应商

| 供应商 | 模型 | 认证 | 备注 |
|--------|------|------|------|
| Anthropic | Claude Opus、Sonnet、Haiku | API 密钥、OAuth（自动刷新） | 主要供应商；OAuth 令牌自动刷新 |
| OpenAI | GPT-4o、GPT-4.1、o1、o3、o4-mini | API 密钥 | 完整的函数调用支持 |
| OpenAI Codex | codex-mini | API 密钥 | 代码专用；通过 Responses API 使用工具 |
| Google Gemini | Gemini 2.5 Pro/Flash | API 密钥 | 原生函数调用 |
| DashScope / 通义千问 | Qwen-Max、Qwen-Plus、Qwen-Turbo | API 密钥 | 阿里云；兼容 API |
| Ollama | 任何 GGUF 模型 | 本地（无需密钥） | 本地推理；无工具调用 |
| OpenRouter | OpenRouter 上的任何模型 | API 密钥 | 聚合器；跨 100+ 模型路由 |
| AWS Bedrock | Claude、Titan、Llama | IAM 凭据 | SigV4 签名；企业部署 |
| GitHub Copilot | GPT-4o、Claude | Copilot 令牌 | 复用 VS Code / CLI Copilot 认证 |
| GLM / 智谱 | GLM-4、GLM-4V | API 密钥 | 中国市场；支持视觉 |
| xAI | Grok | API 密钥 | 兼容 OpenAI 的 API |
| LiteLLM | LiteLLM 代理后的任何模型 | API 密钥或本地 | 统一代理；适用于自定义部署 |
| vLLM | vLLM 服务的任何模型 | 本地端点 | 高吞吐量本地推理 |
| HuggingFace | 推理 API 模型 | API 令牌 | HuggingFace 推理端点 |

## 工具调用抽象

LLM 供应商在工具/函数调用处理方式上各不相同。PRX 通过两种模式进行标准化：

### 原生工具调用

支持结构化工具调用的供应商（Anthropic、OpenAI、Google Gemini 等）在 API 请求中接收工具定义。供应商返回结构化的工具使用块，PRX 直接解析和执行。

### 提示词引导工具调用

对于不支持原生工具的供应商（Ollama、部分 vLLM 模型），PRX 将工具定义注入系统提示词，并附带让模型以结构化文本格式发出工具调用的指令。PRX 然后解析模型输出以提取工具调用。

```
┌──────────────────────────────────┐
│         工具调用流程               │
│                                  │
│  工具定义 ──┬── 原生 ──── 供应商 API（结构化）
│             │
│             └── 提示词引导 ── 系统提示词注入
│                                   ── 输出解析
└──────────────────────────────────┘
```

这种抽象意味着每个供应商都可以参与代理工具循环，无论是否原生支持。

## ReliableProvider 包装器

每个供应商都被包装在 `ReliableProvider` 中以增加韧性：

### 自动重试

失败的请求使用指数退避重试。包装器对错误进行分类以决定重试行为：

| 错误类型 | 重试 | 行为 |
|----------|------|------|
| 速率限制 (429) | 是 | 遵守 `Retry-After` 头；指数退避 |
| 服务器错误 (5xx) | 是 | 最多 3 次重试，带抖动 |
| 认证错误 (401/403) | 否 | 立即失败；对 OAuth 供应商触发令牌刷新 |
| 超时 | 是 | 使用延长的超时重试 |
| 上下文长度超限 | 否 | 立即失败；调用方应截断 |

### 供应商降级链

当供应商耗尽（所有重试失败）时，`ReliableProvider` 降级到配置链中的下一个供应商：

```toml
[router.fallback]
chain = ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o", "google/gemini-2.5-pro"]
```

路由器按顺序尝试每个供应商/模型对。如果主供应商宕机或速率受限，请求透明地转移到下一个选项。

### 模型降级

在单个供应商内，也支持模型级别的降级：

```toml
[providers.anthropic]
models = ["claude-sonnet-4-20250514", "claude-haiku-4-20250414"]
fallback_order = ["claude-sonnet-4-20250514", "claude-haiku-4-20250414"]
```

如果首选模型不可用，PRX 在尝试跨供应商降级之前，先降级到同一供应商的下一个模型。

## 配置

```toml
[providers.anthropic]
enabled = true
api_key = "sk-ant-..."
# 或使用 OAuth（令牌自动刷新）
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
tool_mode = "prompt_guided"   # 无原生工具调用
```

每个供应商条目指定凭据、默认模型，以及工具调用模式、超时和重试限制的可选覆盖。
