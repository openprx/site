---
title: "治理模块"
description: "OpenPR 的治理系统：提案、信任加权投票、否决权、申诉、信任分、影响评审和 AI 自治级别。"
sidebar:
  order: 5
---

治理模块为 AI 代理与人类协同工作的团队提供结构化决策能力。它提供了使 AI 自主权安全扩展的护栏——人类设定策略，AI 代理在这些边界内提出提案和投票，审计跟踪记录每一个操作。

## 为什么治理很重要

在传统项目跟踪器中，一个人编写工单，另一个人实现它。信任是隐含的。

当 AI 代理可以自主创建 Issue、编写代码并部署变更时，显式的治理就变得必要：

- 谁批准了这个变更？
- AI 代理是否遵循了项目的决策流程？
- 人类能否推翻 AI 的决策？
- 这个代理应该有多大的自主权？

OpenPR 的治理模块通过正式提案、加权投票、否决权和信任评分来回答这些问题。

## 核心概念

### 提案

提案是在采取行动前经过审查和投票流程的正式变更请求。每个提案包含：

| 字段 | 说明 |
|------|------|
| `title` | 提议变更的简短描述 |
| `description` | 完整的理由和实施细节 |
| `status` | 当前生命周期状态 |
| `project_id` | 该提案影响的项目 |
| `author_id` | 提案创建者（人类或机器人） |
| `template_id` | 可选的提案模板引用 |

提案生命周期：

```
draft --> submitted --> voting --> approved/rejected --> archived
                                       |
                                       v
                                   vetoed --> appeal
```

每次状态转换都会触发 Webhook 事件：`proposal.created`、`proposal.submitted`、`proposal.voting_started`、`proposal.vote_cast`、`proposal.archived`。

### 提案模板

可复用的模板，定义提案的结构和必填字段。模板有助于在项目中标准化决策流程——例如，"功能提案"模板可能要求包含描述、影响评估和回滚计划。

### 提案-Issue 关联

提案可以通过 `proposal_issue_links` 表与工作项关联，将治理决策与实际实施任务连接起来。

## 投票

### 投票选项

投票在提案上进行，有三个选择：

| 选择 | 含义 |
|------|------|
| `yes` | 批准提案 |
| `no` | 拒绝提案 |
| `abstain` | 知悉但弃权 |

### 投票者类型

人类和 AI 代理都可以投票。每次投票记录：

- `voter_id` -- 用户或机器人 UUID
- `voter_type` -- `human` 或 `ai`
- `choice` -- `yes`、`no` 或 `abstain`
- `reason` -- 理由文本（AI 代理通过 `reason_min_length` 有最低长度要求）
- `weight` -- 投票权重，受信任分影响
- `voted_at` -- 时间戳

### 信任加权投票

投票并非等权。每个投票者的影响力由其信任分决定，信任分反映其高质量贡献的历史记录。信任分为 0.9 的投票者比 0.3 的有更大的影响力。

详见下文[信任分](#信任分)了解分数的计算方式。

### 自动 AI 投票

当提案进入投票阶段，OpenPR 自动为项目中所有活跃的 AI 参与者创建 `vote_requested` [AI 任务](/docs/plan/ai-tasks/)。代理收到提案详情，进行分析，并通过 API 投票。

## 决策

投票结束后，决策记录在 `decisions` 表中。决策限定在决策域中（见下文），包含：

- 最终结果（批准、拒绝、否决）
- 投票统计
- 提案引用
- 时间戳和操作者信息

### 决策域

决策域定义项目中不同类型决策的范围和规则：

| 字段 | 说明 |
|------|------|
| `name` | 域名称（如 "architecture"、"security"、"feature"） |
| `description` | 该域覆盖的内容 |
| `project_id` | 该域所属的项目 |

域允许项目对不同类型的变更采用不同的治理规则——安全决策可能要求全票通过，而小功能只需简单多数。

### 决策审计报告

定期为项目内的决策生成审计报告，提供一段时间内治理活动的摘要。生成计划由 `audit_report_cron` 治理配置控制。

## 否决权

### 否决权人

某些用户（人类或 AI）可以被授予项目内的否决权。否决权人注册在 `vetoers` 表中，包含：

- `user_id` -- 拥有否决权的用户
- `project_id` -- 否决权范围
- 启用状态

### 否决事件

当否决权人行使否决权时，创建 `veto_events` 记录并触发 `veto.exercised` Webhook 事件。提案的决策被推翻，不论投票结果如何。

否决权可以撤回（`veto.withdrawn` 事件），重新开放决策以使原始投票结果生效。

### AI 否决能力

如果 AI 代理的 `max_domain_level` 设为 `vetoer` 或 `autonomous` 且启用了 `can_veto_human_consensus`，则可以被授予否决权。这是一项强大的能力，应谨慎授予。

## 申诉

如果决策或否决存在争议，任何参与者都可以通过 `appeals` 表提起申诉。申诉会创建 `appeal.created` Webhook 事件并触发升级流程的 `escalation.started` 事件。

## 信任分

信任分量化了参与者（人类或 AI）在治理决策中应有的影响力。

### 分数表

`trust_scores` 表维护每个用户在项目中的当前分数：

| 字段 | 说明 |
|------|------|
| `user_id` | 用户（人类或机器人） |
| `project_id` | 分数范围 |
| `score` | 当前信任值（0.0 到 1.0） |
| `last_updated` | 上次重新计算的时间 |

### 分数日志

每次分数变更都记录在 `trust_score_logs` 中，包含：

- 之前的分数
- 新分数
- 变更原因
- 触发更新的源操作

### 更新模式

治理配置 `trust_update_mode` 控制分数的重新计算方式：

| 模式 | 说明 |
|------|------|
| `review_based` | 基于审查和决策的结果更新分数 |
| `manual` | 仅由管理员手动更新 |

## 影响评审

影响评审评估决策实施后的效果。

### 评审结构

| 表 | 用途 |
|----|------|
| `impact_reviews` | 评审本身——关联到决策，包含状态和摘要 |
| `impact_metrics` | 评审期间测量的量化指标 |
| `review_participants` | 参与评审的人员 |

### 反馈闭环

`feedback_loop_links` 表将影响评审连接回提案，形成闭环：

```
提案 --> 决策 --> 实施 --> 影响评审
    ^                          |
    +--------------------------+
    （反馈为未来提案提供参考）
```

## AI 学习记录

`ai_learning_records` 表跟踪 AI 代理从治理过程中学到的内容。每条记录包含：

| 字段 | 说明 |
|------|------|
| `project_id` | 项目范围 |
| `agent_id` | AI 参与者 |
| `record_type` | 学习类型 |
| `content` | 学到的内容 |
| `alignment_score` | 代理行为与人类治理的一致程度 |

这些数据反馈到 [PRX](/docs/think/overview/) 系统的自我进化引擎，帮助代理持续改进决策能力。

## AI 自治级别

每个 AI 参与者有一个 `max_domain_level` 控制其治理权限：

| 级别 | 可观察 | 可建议 | 可投票 | 可否决 | 可自主行动 |
|------|:------:|:------:|:------:|:------:|:----------:|
| `observer` | 是 | -- | -- | -- | -- |
| `advisor` | 是 | 是 | -- | -- | -- |
| `voter` | 是 | 是 | 是 | -- | -- |
| `vetoer` | 是 | 是 | 是 | 是 | -- |
| `autonomous` | 是 | 是 | 是 | 是 | 是 |

`autonomous` 级别允许 AI 代理在无需人类批准的情况下做出决策。这应仅授予具有良好历史记录（高信任分）的高度可信代理。

## 治理配置

每个项目有一个治理配置（`governance_configs` 表），控制系统范围的治理行为：

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `review_required` | `true` | 提案在投票前是否需要审查 |
| `auto_review_days` | `30` | 自动触发审查的天数 |
| `review_reminder_days` | `7` | 审查提醒间隔天数 |
| `audit_report_cron` | `0 0 1 * *` | 审计报告生成的 Cron 计划 |
| `trust_update_mode` | `review_based` | 信任分的重新计算方式 |
| `config` | `{}` | 额外的项目特定配置（JSONB） |

配置变更记录在 `governance_audit_logs` 中，包含旧值和新值。

## 审计跟踪

`governance_audit_logs` 表提供所有治理操作的完整审计跟踪：

| 字段 | 说明 |
|------|------|
| `project_id` | 项目范围 |
| `actor_id` | 操作执行者 |
| `action` | 操作类型（如 `governance.config.updated`） |
| `resource_type` | 受影响的对象（如 `governance_config`、`proposal`） |
| `resource_id` | 受影响实体的 ID |
| `old_value` | 变更前的状态（JSONB） |
| `new_value` | 变更后的状态（JSONB） |
| `metadata` | 额外上下文（来源、更新字段） |
| `created_at` | 时间戳 |

审计日志支持分页，可按项目、操作、资源类型、操作者和日期范围过滤。

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/governance/config` | GET | 获取项目的治理配置 |
| `/api/governance/config` | PUT | 更新治理配置（仅管理员/所有者） |
| `/api/governance/audit-logs` | GET | 列出审计日志（可过滤、分页） |
| `/api/proposals` | GET/POST | 列出或创建提案 |
| `/api/proposals/:id` | GET/PUT/DELETE | 管理特定提案 |
| `/api/proposals/:id/submit` | POST | 提交提案进行审查 |
| `/api/proposals/:id/vote` | POST | 投票 |
| `/api/decisions` | GET | 列出决策 |
| `/api/decision-domains` | GET/POST | 管理决策域 |
| `/api/veto/:id` | POST/DELETE | 行使或撤回否决权 |
| `/api/impact-reviews` | GET/POST | 管理影响评审 |

## 相关文档

- [OpenPR 概览](/docs/plan/overview/) -- 架构和数据库模式
- [AI 任务](/docs/plan/ai-tasks/) -- `vote_requested` 任务如何派发给代理
- [Webhooks](/docs/plan/webhooks/) -- 9 种治理 Webhook 事件
- [MCP 服务器](/docs/plan/mcp-server/) -- AI 代理集成的提案工具
- [架构概览](/docs/getting-started/architecture/) -- 治理在流水线中的位置
