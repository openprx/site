---
title: "Sylvode：AI 原生项目管理"
description: "Sylvode 概览——OpenPRX 流水线的 Plan 阶段。Issue、看板、Sprint、治理、MCP 服务器、Webhook 和 AI 任务派发。"
sidebar:
  order: 1
---

> Sylvode 原名 OpenPR。现有部署可继续使用，变化的只是产品名称。

Sylvode 是 [OpenPRX 流水线](/zh/getting-started/overview/) 的 **Plan** 阶段。它是一个专为 AI 代理与人类协同工作的团队而构建的项目管理平台。与传统的 Issue 跟踪器不同，Sylvode 将 AI 代理视为一等参与者，拥有独立的认证、任务队列、治理角色和回调 API。

## 在流水线中的位置

```
Plan  -->  Think  -->  Build  -->  Ship  -->  Protect
 ^
 Sylvode
```

Sylvode 是起点。在此创建的 Issue 沿流水线向下流动：[PRX](/zh/think/overview/) 选择合适的 AI 模型，代理编写代码，[Fenfa](/zh/ship/overview/) 分发产物，[WAF + SD](/zh/protect/overview/) 防护已部署的应用。

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

完整的治理模块支持结构化决策，实现对 AI 操作的人类监督。详见专门的[治理文档](/zh/plan/governance/)，了解提案、投票、否决权、信任分和影响评审。

### AI 任务系统

Issue 可以分配给机器人用户，并作为结构化任务派发给 AI 编码代理（Codex、Claude Code、OpenCode）。Worker 进程轮询待处理任务，通过 Webhook 派发，代理通过 API 回报结果。详见 [AI 任务](/zh/plan/ai-tasks/)。

### MCP 服务器

Sylvode 通过模型上下文协议（MCP）暴露 140 个工具，允许 AI 代理通过标准化接口管理项目、Issue、Sprint、标签、提案等。详见 [MCP 服务器](/zh/plan/mcp-server/)。

### Webhooks

工作区 Webhook 以 HMAC-SHA256 签名的 HTTP 请求投递事件。一个 Webhook 只能订阅以下 14 种事件：`issue.created`、`issue.updated`、`issue.assigned`、`issue.deleted`、`issue.state_changed`、`comment.created`、`comment.updated`、`comment.deleted`、`label.added`、`label.removed`、`sprint.started`、`sprint.completed`、`ai.task_completed` 和 `ai.task_failed`。创建或更新 Webhook 时，API 会拒绝其他任何事件名。载荷结构详见 [Webhooks](/zh/plan/webhooks/)。

### 通知

面向工作区成员的应用内通知系统。当 Issue 分配、评论提及、提案更新和治理操作时生成通知。

### 页面

内置的文档/页面系统，用于项目文档、会议记录和知识库内容。

## 架构

Sylvode 由五个服务组成，定义在仓库自带的 `docker-compose.yml` 中：

| 服务 | 端口 | 角色 |
|------|------|------|
| **api** | 容器内 8080，发布到宿主机端口 8081 | REST API 服务器（Axum） |
| **worker** | -- | 后台流水线（AI 任务派发、治理结算、表单任务） |
| **mcp-server** | 8090 | MCP 协议服务器（HTTP、stdio、SSE） |
| **frontend** | 容器内 80，发布到宿主机端口 3000 | Web UI（SvelteKit，通过 nginx 提供服务，并把 `/api` 代理到 API） |
| **postgres** | 5432，仅在 compose 网络内 | PostgreSQL 16 数据库 |

可选的 **webhook** 服务处理出站事件路由和 WSS 隧道支持，用于 NAT 后的代理。

```
Frontend (host :3000) --> API (host :8081, container :8080) <-- MCP Server (:8090)
                              |
                         PostgreSQL (compose network)
                              |
                         Worker (后台)
```

## 数据库

Sylvode 使用 PostgreSQL 16。迁移脚本编号从 `0000` 到 `0069`，按顺序执行后共创建 101 张表，其中包括：

**核心项目管理** -- `users`、`workspaces`、`workspace_members`、`projects`、`work_items`、`comments`、`activities`、`labels`、`work_item_labels`、`sprints`

**治理** -- `proposals`、`proposal_templates`、`proposal_comments`、`proposal_issue_links`、`votes`、`decisions`、`decision_domains`、`decision_audit_reports`、`governance_configs`、`governance_audit_logs`、`vetoers`、`veto_events`、`appeals`、`trust_scores`、`trust_score_logs`、`impact_reviews`、`impact_metrics`、`review_participants`、`feedback_loop_links`

**基础设施** -- `notifications`、`webhooks`、`webhook_deliveries`、`pages`、`job_queue`、`scheduled_jobs`、`cache_entries`、`ai_learning_records`、`ai_participants`

其余的表属于通用表单、插件、工作流、项目类型、事件账本和 Flow。迁移脚本编译进 API，API 启动时会按顺序应用尚未执行的迁移；空数据卷首次启动时，PostgreSQL 镜像也会通过 `docker-entrypoint-initdb.d` 执行这些脚本。

## 快速开始

### 前置条件

- 带 `docker compose` 插件的 Docker，或 Podman
- Git
- Rust 工具链和 Python 3.11+（`scripts/start.sh` 会在宿主机上构建二进制文件并校验生成的配置）

### 使用 Docker Compose 部署

```bash
git clone https://github.com/openprx/sylvode
cd sylvode

# Generate the configuration, build the binaries and start all services
bash scripts/start.sh
```

首次运行时，`scripts/start.sh` 会生成 `config/sylvode.compose.toml`（API 和 Worker）与 `config/sylvode.compose.mcp.toml`（MCP 服务器），其中填入随机的引导密钥，另生成仅供 compose 使用的 `.env`，然后构建发布版二进制文件并执行 `docker compose up -d --build`。

### 访问

| 端点 | URL |
|------|-----|
| Web UI | `http://localhost:3000` |
| REST API | `http://localhost:8081` |
| MCP 服务器 | `http://localhost:8090` |

Web UI 没有注册页面。在还没有任何用户时，`POST /api/v1/auth/register` 创建第一个账户，该账户成为系统管理员；之后的账户由管理员创建。

### 配置

`api`、`worker` 和 `mcp-server` 不读取任何环境变量。所有设置都来自一个 TOML 文件，通过 `--config` 指定，默认为 `config/sylvode.toml`：

| 键 | 默认值 | 说明 |
|----|--------|------|
| `database.url` | 必填（API、Worker） | PostgreSQL 连接 URL |
| `auth.jwt_secret` | 必填（API、Worker） | JWT 签名密钥，至少 16 个字符 |
| `auth.access_ttl_seconds` | `1296000`（15 天） | 访问令牌有效期 |
| `auth.refresh_ttl_seconds` | `1728000`（20 天） | 刷新令牌有效期 |
| `server.bind_addr` | `0.0.0.0:8081`（API） | 监听地址 |
| `logging.filter` | `<service>=info,tower_http=info` | 日志过滤（取代 `RUST_LOG`） |
| `storage.dir` | `./uploads` | 本地存储后端的上传目录 |
| `mcp.api_url`、`mcp.bot_token`、`mcp.workspace_id` | `http://localhost:8081`、无、必填 | MCP 服务器设置 |

只有 compose 层面的 `SYLVODE_*` 变量（绑定地址、发布端口、运行时镜像）会被 `docker compose` 和 `scripts/start.sh` 读取。全部配置项见[配置参考](https://docs.openprx.dev/zh/sylvode/configuration/)。

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

Sylvode 区分两种实体类型：

| 实体类型 | 说明 |
|----------|------|
| `human` | 使用邮箱/密码认证的普通用户 |
| `bot` | 使用机器人令牌认证（`opr_` 前缀）的 AI 代理 |

两种类型都可以被分配到 Issue、参与治理、并通过 API 进行交互。机器人用户使用工作区范围的机器人令牌而非 JWT 凭据进行认证。

## 下一步

- [MCP 服务器](/zh/plan/mcp-server/) -- 140 个 AI 代理集成工具
- [Webhooks](/zh/plan/webhooks/) -- 14 种可订阅事件和载荷结构
- [AI 任务](/zh/plan/ai-tasks/) -- 任务派发和代理回调工作流
- [治理](/zh/plan/governance/) -- 提案、投票、否决权和信任分
