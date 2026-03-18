---
title: 什么是 OpenPRX？
description: OpenPRX AI 自主软件工程基础设施简介。
sidebar:
  order: 1
---

OpenPRX 是一个开源基础设施技术栈，AI 代理在其中自主管理整个软件生命周期——从项目规划到代码生成，再到分发和安全防御。

## 流水线

OpenPRX 以五阶段流水线方式组织：

```
Plan → Think → Build → Ship → Protect
```

| 阶段 | 产品 | 功能 |
|------|------|------|
| **Plan** | [OpenPR](/docs/plan/overview/) | AI 原生项目管理，支持 MCP、Webhook、治理 |
| **Think** | [PRX](/docs/think/overview/) | AI 编排大脑——14 个供应商、智能路由、自我进化 |
| **Build** | [Webhook + Memory](/docs/build/overview/) | 代理调度、代码执行、知识持久化 |
| **Ship** | [Fenfa](/docs/ship/overview/) | 多平台应用分发，带上传 API |
| **Protect** | [WAF + SD](/docs/protect/overview/) | 17 阶段 Web 防御 + 基于 ML 的杀毒引擎 |

## 与众不同之处

**传统 AI 工具**（Copilot、Cursor）一次只辅助一个开发者，帮你更快地输入代码。

**OpenPRX** 自主运行整个工作流：

1. 在 OpenPR 中创建一个 Issue
2. OpenPR 通过 Webhook 将任务派发给 AI 编码代理
3. PRX 选择合适的模型，委派给子代理
4. 代理编写代码、提交并汇报结果
5. CI 构建产物，Fenfa 进行分发
6. WAF 和 SD 保护部署后的应用
7. 安全事件反馈回 OpenPR，生成新的 Issue

人类进行治理——设定策略、审查提案、对决策投票。AI 在这些边界内运作。

## 关键数据

| 指标 | 数值 |
|------|------|
| Rust 代码总量 | 170K+ 行 |
| 消息通道 | 19 个（Signal、WhatsApp、Telegram、Discord、Slack 等） |
| LLM 供应商 | 14 个（Anthropic、OpenAI、Google、Ollama 等） |
| MCP 工具 | 34 个 |
| 安全规则 | 38,800+ 条 YARA 规则 |
| WAF 检测阶段 | 17 个 |
| 自我进化系统 | 9,800 行代码 |

## 技术栈

所有核心产品均使用 **Rust** 构建，以确保性能和可靠性。技术栈包括：

- **Rust** — PRX、OpenPR、WAF、SD、Memory、Webhook 的核心运行时
- **Go** — Fenfa 分发平台
- **PostgreSQL** — OpenPR 和 WAF 的持久化存储
- **SQLite** — Memory、SD 签名（LMDB）、Email
- **Vue 3 + Tauri** — PRX-SD 桌面 GUI
- **SvelteKit** — OpenPR 前端

## 快速开始

选择你需要的组件，或部署完整技术栈：

```bash
# 从项目管理开始
git clone https://github.com/openprx/openpr && cd openpr
docker compose up -d

# 添加 AI 大脑
git clone https://github.com/openprx/prx && cd prx
cargo run --release

# 为代理添加持久化记忆
git clone https://github.com/openprx/prx-memory && cd prx-memory
cargo run --features http
```

请参阅各产品的文档以获取详细的部署说明。
