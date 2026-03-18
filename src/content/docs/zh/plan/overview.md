---
title: "OpenPR：AI 原生项目管理"
description: "OpenPR 概览——OpenPRX 流水线的 Plan 阶段。Issue、看板、Sprint、治理、MCP 服务器、Webhook 和 AI 任务派发。"
sidebar:
  order: 1
---

OpenPR 是 [OpenPRX 流水线](/docs/getting-started/overview/) 的 **Plan** 阶段。它是一个专为 AI 代理与人类协同工作的团队而构建的项目管理平台。与传统的 Issue 跟踪器不同，OpenPR 将 AI 代理视为一等参与者，拥有独立的认证、任务队列、治理角色和回调 API。

## 在流水线中的位置

```
Plan  -->  Think  -->  Build  -->  Ship  -->  Protect
 ^
 OpenPR
```

OpenPR 是起点。在此创建的 Issue 沿流水线向下流动：[PRX](/docs/think/overview/) 选择合适的 AI 模型，代理编写代码，[Fenfa](/docs/ship/overview/) 分发产物，[WAF + SD](/docs/protect/overview/) 防护已部署的应用。

## 核心功能

### Issue 跟踪与看板

工作项（Issue）支持完整的生命周期，包含四个状态：

| 状态 | 含义 |
|------|------|
| `backlog` | 尚未排期 |
| `todo` | 已排入当前或下一个 Sprint |
| `in_progress` | 正在进行中 |
| `done` | 已完成 |

每个 Issue 包含优先级（`low`、`medium`、`high`、`urgent`）、可选标签、指派人（人类或机器人）以及 Sprint 关联。Issue 归属于项目，项目归属于工作区。

### Sprint

有时间限制的迭代周期，带有开始和结束日期。Sprint 可以创建、更新、启动和完成。当 Sprint 启动或完成时，会触发 Webhook 事件以供下游自动化使用。

### 治理

完整的治理模块支持结构化决策，实现对 AI 操作的人类监督。详见专门的[治理文档](/docs/plan/governance/)，了解提案、投票、否决权、信任分和影响评审。

### AI 任务系统

Issue 可以分配给机器人用户，并作为结构化任务派发给 AI 编码代理（Codex、Claude Code、OpenCode）。Worker 进程轮询待处理任务，通过 Webhook 派发，代理通过 API 回报结果。详见 [AI 任务](/docs/plan/ai-tasks/)。

### MCP 服务器

OpenPR 通过模型上下文协议（MCP）暴露 34 个工具，允许 AI 代理通过标准化接口管理项目、Issue、Sprint、标签、提案等。详见 [MCP 服务器](/docs/plan/mcp-server/)。

### Webhooks

30 种事件类型通过 HMAC-SHA256 签名的 HTTP Webhook 触发，覆盖 Issue、评论、标签、Sprint、提案、治理和 AI 任务生命周期。详见 [Webhooks](/docs/plan/webhooks/)。

### 通知

面向工作区成员的应用内通知系统。当 Issue 分配、评论提及、提案更新和治理操作时生成通知。

### 页面

内置的文档/页面系统，用于项目文档、会议记录和知识库内容。

## 架构

OpenPR 由五个服务组成：

| 服务 | 端口 | 角色 |
|------|------|------|
| **api** | 8080 | REST API 服务器（Axum） |
| **worker** | -- | 后台任务调度器（轮询 `ai_tasks` 表） |
| **mcp-server** | 8090 | MCP 协议服务器（HTTP、stdio、SSE） |
| **frontend** | 80 | Web UI（SvelteKit，通过 nginx 提供服务） |
| **postgres** | 5432 | PostgreSQL 16 数据库 |

可选的 **webhook** 服务处理出站事件路由和 WSS 隧道支持，用于 NAT 后的代理。

```
Frontend (nginx :3000) --> API (:8080) <-- MCP Server (:8090)
                              |
                         PostgreSQL (:5432)
                              |
                         Worker (后台)
```

## 数据库

OpenPR 使用 PostgreSQL 16，包含 38 张表，分为三组：

**核心项目管理** -- `users`、`workspaces`、`workspace_members`、`projects`、`work_items`、`comments`、`activities`、`labels`、`work_item_labels`、`sprints`

**治理** -- `proposals`、`proposal_templates`、`proposal_comments`、`proposal_issue_links`、`votes`、`decisions`、`decision_domains`、`decision_audit_reports`、`governance_configs`、`governance_audit_logs`、`vetoers`、`veto_events`、`appeals`、`trust_scores`、`trust_score_logs`、`impact_reviews`、`impact_metrics`、`review_participants`、`feedback_loop_links`

**基础设施** -- `notifications`、`webhooks`、`webhook_deliveries`、`pages`、`job_queue`、`scheduled_jobs`、`cache_entries`、`ai_learning_records`、`ai_participants`

数据库迁移脚本编号从 `0001` 到 `0019`，在首次启动时通过 PostgreSQL 的 `docker-entrypoint-initdb.d` 机制自动应用。

## 快速开始

### 前置条件

- Docker 和 Docker Compose
- Git

### 使用 Docker Compose 部署

```bash
git clone https://github.com/openprx/openpr
cd openpr

# 设置生产环境 JWT 密钥
export JWT_SECRET="your-secure-random-string"

# 启动所有服务
docker compose up -d
```

这将启动 PostgreSQL、运行迁移、并启动 API、Worker、MCP 服务器和前端。

### 访问

| 端点 | URL |
|------|-----|
| Web UI | `http://localhost:3000` |
| REST API | `http://localhost:8081` |
| MCP 服务器 | `http://localhost:8090` |

第一个注册的用户将自动成为工作区管理员。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | `change-me-in-production` | JWT 令牌签名密钥 |
| `JWT_ACCESS_TTL_SECONDS` | `2592000`（30 天） | 访问令牌有效期 |
| `JWT_REFRESH_TTL_SECONDS` | `2592000`（30 天） | 刷新令牌有效期 |
| `DATABASE_URL` | （在 compose 中设置） | PostgreSQL 连接字符串 |
| `RUST_LOG` | `info` | 日志级别过滤 |
| `UPLOAD_DIR` | `/app/uploads` | 文件上传存储目录 |

### 生产环境部署

生产环境下，在前端前方放置反向代理（Caddy、nginx）：

```
# Caddy 配置示例
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy 通过 Let's Encrypt 自动配置 TLS 证书。

## 用户模型

OpenPR 区分两种实体类型：

| 实体类型 | 说明 |
|----------|------|
| `human` | 使用邮箱/密码认证的普通用户 |
| `bot` | 使用机器人令牌认证（`opr_` 前缀）的 AI 代理 |

两种类型都可以被分配到 Issue、参与治理、并通过 API 进行交互。机器人用户使用工作区范围的机器人令牌而非 JWT 凭据进行认证。

## 下一步

- [MCP 服务器](/docs/plan/mcp-server/) -- 34 个 AI 代理集成工具
- [Webhooks](/docs/plan/webhooks/) -- 30 种事件类型和载荷结构
- [AI 任务](/docs/plan/ai-tasks/) -- 任务派发和代理回调工作流
- [治理](/docs/plan/governance/) -- 提案、投票、否决权和信任分
