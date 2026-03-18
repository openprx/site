---
title: 什么是 PRX？
description: PRX 是一个自我进化的 AI 编排守护进程——OpenPRX 流水线的大脑，跨 19 个通道和 14 个 LLM 供应商路由消息。
sidebar:
  order: 1
---

PRX 是一个用 169K 行 Rust 代码编写的持久 AI 编排守护进程。它不是单个 LLM 的封装器。它是一个持续运行的进程，从 19 个通道接收消息，通过智能模型选择器路由，将工作委派给子代理，并随时间进化自身行为。

## 在流水线中的角色

在 OpenPRX 流水线（`Plan -> Think -> Build -> Ship -> Protect`）中，PRX 占据 **Think** 阶段。它是中枢神经系统：每一个 AI 驱动的决策都流经 PRX。

```
OpenPR (Plan)                          Fenfa (Ship)
    │                                      ▲
    ▼                                      │
  PRX ── 子代理 ── prx-memory ── CI ───┘
    │
    ▼
  WAF + SD (Protect)
```

OpenPR 派发任务。PRX 决定由哪个模型处理任务，管理对话历史，执行安全策略，并将子任务委派给自主子代理。结果流回 OpenPR 和下游阶段。

## 核心子系统

| 子系统 | 用途 |
|--------|------|
| [通道](/docs/think/channels/) | 19 个消息集成（Signal、WhatsApp、Telegram、Discord、Slack、Matrix 等） |
| [供应商](/docs/think/providers/) | 14 个 LLM 后端，统一的工具调用抽象 |
| [路由器](/docs/think/router/) | 智能模型选择：意图分类、Elo 评分、KNN 语义路由、Automix |
| [子代理](/docs/think/sub-agents/) | 三层委派：同步命名代理、异步即发即忘会话、管理命令 |
| [自我进化](/docs/think/self-evolution/) | 自主改进提示词、记忆和策略，带安全门控 |
| [安全](/docs/think/security/) | 5 层策略流水线、审批工作流、沙箱执行（Docker、Firejail、Bubblewrap、Landlock、WASM） |
| 插件 | 基于 WASM 的插件系统，使用 wasmtime 沙箱 |
| MCP 客户端 | 连接外部 MCP 服务器以使用工具 |
| 远程节点 | 通过 `prx-node` 实现分布式执行，使用 H2 传输和设备配对 |

## 工作原理

1. 消息从任一通道到达（Telegram、Signal、CLI、Webhook 等）
2. PRX 维护每个发送者的对话历史（最近 50 条消息），自动压缩
3. 路由器分类意图，对候选模型评分，选择最佳供应商
4. 选定的 LLM 生成响应，可能调用工具
5. 如果任务需要委派，生成子代理（同步或异步）
6. 自我进化系统记录结果，供定期分析和改进
7. 安全策略在每一层执行：命令执行、文件访问、费用限制

## 快速开始

```bash
# 克隆并构建
git clone https://github.com/openprx/prx && cd prx
cargo build --release

# 至少配置一个供应商和一个通道
cp config.example.toml config.toml
# 编辑 config.toml：设置你的 API 密钥和通道凭据

# 运行守护进程
./target/release/prx --config config.toml

# 或使用 CLI 通道进行即时交互
./target/release/prx --cli
```

PRX 从 TOML 文件读取配置。至少需要一个供应商（如带 API 密钥的 Anthropic）和一个通道（如用于本地测试的 CLI）。详细配置请参阅各子系统页面。
