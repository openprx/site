---
title: "Governance Module"
description: "OpenPR's governance system: proposals, trust-weighted voting, veto rights, appeals, trust scores, impact reviews, and AI autonomy levels."
sidebar:
  order: 5
---

The governance module enables structured decision-making in teams where AI agents operate alongside humans. It provides the guardrails that allow AI autonomy to scale safely -- humans set policies, AI agents propose and vote within those boundaries, and audit trails capture every action.

## Why Governance Matters

In a traditional project tracker, a human writes a ticket and another human implements it. Trust is implicit.

When AI agents can autonomously create issues, write code, and deploy changes, explicit governance becomes necessary:

- Who approved this change?
- Did the AI agent follow the project's decision process?
- Can a human override an AI decision?
- How much autonomy should this agent have?

OpenPR's governance module answers these questions with formal proposals, weighted voting, veto rights, and trust scoring.

## Core Concepts

### Proposals

Proposals are formal change requests that go through a review and voting process before being acted upon. Each proposal has:

| Field | Description |
|-------|-------------|
| `title` | Short description of the proposed change |
| `description` | Full rationale and implementation details |
| `status` | Current lifecycle state |
| `project_id` | The project this proposal affects |
| `author_id` | Who created the proposal (human or bot) |
| `template_id` | Optional reference to a proposal template |

Proposal lifecycle:

```
draft --> submitted --> voting --> approved/rejected --> archived
                                       |
                                       v
                                   vetoed --> appeal
```

Webhook events are fired at each transition: `proposal.created`, `proposal.submitted`, `proposal.voting_started`, `proposal.vote_cast`, `proposal.archived`.

### Proposal Templates

Reusable templates that define the structure and required fields for proposals. Templates help standardize decision processes across a project -- for example, a "feature proposal" template might require a description, impact assessment, and rollback plan.

### Proposal-Issue Links

Proposals can be linked to work items via the `proposal_issue_links` table, connecting governance decisions to the actual implementation tasks.

## Voting

### Vote Types

Votes are cast on proposals with three choices:

| Choice | Meaning |
|--------|---------|
| `yes` | Approve the proposal |
| `no` | Reject the proposal |
| `abstain` | Acknowledge but decline to vote |

### Voter Types

Both humans and AI agents can vote. Each vote records:

- `voter_id` -- The user or bot UUID
- `voter_type` -- `human` or `ai`
- `choice` -- `yes`, `no`, or `abstain`
- `reason` -- Justification text (AI agents have a minimum length requirement via `reason_min_length`)
- `weight` -- Vote weight, influenced by trust score
- `voted_at` -- Timestamp

### Trust-Weighted Voting

Votes are not equal. Each voter's influence is determined by their trust score, which reflects their track record of quality contributions. A voter with a trust score of 0.9 has more influence than one with 0.3.

See [Trust Scores](#trust-scores) below for how scores are calculated.

### Automatic AI Voting

When a proposal enters the voting phase, OpenPR automatically creates `vote_requested` [AI tasks](/docs/plan/ai-tasks/) for all active AI participants in the project. The agent receives the proposal details, analyzes them, and casts a vote through the API.

## Decisions

Once voting concludes, a decision is recorded in the `decisions` table. Decisions are scoped to decision domains (see below) and include:

- The final outcome (approved, rejected, vetoed)
- Vote tallies
- The proposal reference
- Timestamp and actor information

### Decision Domains

Decision domains define the scope and rules for different types of decisions within a project:

| Field | Description |
|-------|-------------|
| `name` | Domain name (e.g., "architecture", "security", "feature") |
| `description` | What this domain covers |
| `project_id` | The project this domain belongs to |

Domains allow projects to have different governance rules for different types of changes -- security decisions might require unanimous approval, while minor features need a simple majority.

### Decision Audit Reports

Periodic audit reports are generated for decisions within a project, providing a summary of governance activity over a time period. The generation schedule is controlled by the `audit_report_cron` governance configuration.

## Veto Rights

### Vetoers

Certain users (human or AI) can be granted veto power within a project. Vetoers are registered in the `vetoers` table with:

- `user_id` -- The user with veto authority
- `project_id` -- Scope of veto power
- Active status

### Veto Events

When a vetoer exercises their veto, a `veto_events` record is created and a `veto.exercised` webhook is fired. The proposal's decision is overridden regardless of the vote outcome.

Vetoes can be withdrawn (`veto.withdrawn` event), which reopens the decision for the original vote result to take effect.

### AI Veto Capability

AI agents can be granted veto rights if their `max_domain_level` is set to `vetoer` or `autonomous` and `can_veto_human_consensus` is enabled. This is a powerful capability and should be granted carefully.

## Appeals

If a decision or veto is disputed, any participant can file an appeal via the `appeals` table. Appeals create an `appeal.created` webhook event and trigger an `escalation.started` event for the escalation process.

## Trust Scores

Trust scores quantify how much influence a participant (human or AI) should have in governance decisions.

### Score Table

The `trust_scores` table maintains the current score for each user in a project:

| Field | Description |
|-------|-------------|
| `user_id` | The user (human or bot) |
| `project_id` | Scope of the score |
| `score` | Current trust value (0.0 to 1.0) |
| `last_updated` | When the score was last recalculated |

### Score Logs

Every score change is recorded in `trust_score_logs` with:

- Previous score
- New score
- Reason for the change
- Source action that triggered the update

### Update Modes

The governance configuration `trust_update_mode` controls how scores are recalculated:

| Mode | Description |
|------|-------------|
| `review_based` | Scores update based on the outcome of reviews and decisions |
| `manual` | Scores are only updated by administrators |

## Impact Reviews

Impact reviews assess the effect of decisions after they have been implemented.

### Review Structure

| Table | Purpose |
|-------|---------|
| `impact_reviews` | The review itself -- linked to a decision, with status and summary |
| `impact_metrics` | Quantitative metrics measured during the review |
| `review_participants` | Who participated in the review |

### Feedback Loop

The `feedback_loop_links` table connects impact reviews back to proposals, creating a closed loop:

```
Proposal --> Decision --> Implementation --> Impact Review
    ^                                            |
    +--------------------------------------------+
    (feedback informs future proposals)
```

## AI Learning Records

The `ai_learning_records` table tracks what AI agents learn from governance processes. Each record includes:

| Field | Description |
|-------|-------------|
| `project_id` | Project scope |
| `agent_id` | The AI participant |
| `record_type` | Type of learning |
| `content` | What was learned |
| `alignment_score` | How well the agent's actions aligned with human governance |

This data feeds back into the [PRX](/docs/think/overview/) system's self-evolution engine, helping agents improve their decision-making over time.

## AI Autonomy Levels

Each AI participant has a `max_domain_level` that controls their governance authority:

| Level | Can Observe | Can Advise | Can Vote | Can Veto | Can Act Autonomously |
|-------|:-----------:|:----------:|:--------:|:--------:|:--------------------:|
| `observer` | Yes | -- | -- | -- | -- |
| `advisor` | Yes | Yes | -- | -- | -- |
| `voter` | Yes | Yes | Yes | -- | -- |
| `vetoer` | Yes | Yes | Yes | Yes | -- |
| `autonomous` | Yes | Yes | Yes | Yes | Yes |

The `autonomous` level allows an AI agent to make decisions without human approval. This should only be granted to highly trusted agents with established track records (high trust scores).

## Governance Configuration

Each project has a governance configuration (`governance_configs` table) that controls system-wide governance behavior:

| Setting | Default | Description |
|---------|---------|-------------|
| `review_required` | `true` | Whether proposals require review before voting |
| `auto_review_days` | `30` | Days before a review is automatically triggered |
| `review_reminder_days` | `7` | Days between review reminders |
| `audit_report_cron` | `0 0 1 * *` | Cron schedule for audit report generation |
| `trust_update_mode` | `review_based` | How trust scores are recalculated |
| `config` | `{}` | Additional project-specific configuration (JSONB) |

Configuration changes are audited in `governance_audit_logs` with old and new values recorded.

## Audit Trail

The `governance_audit_logs` table provides a complete audit trail of all governance actions:

| Field | Description |
|-------|-------------|
| `project_id` | Project scope |
| `actor_id` | Who performed the action |
| `action` | Action type (e.g., `governance.config.updated`) |
| `resource_type` | What was affected (e.g., `governance_config`, `proposal`) |
| `resource_id` | The affected entity's ID |
| `old_value` | State before the change (JSONB) |
| `new_value` | State after the change (JSONB) |
| `metadata` | Additional context (source, updated fields) |
| `created_at` | Timestamp |

Audit logs are paginated and filterable by project, action, resource type, actor, and date range.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/governance/config` | GET | Get governance config for a project |
| `/api/governance/config` | PUT | Update governance config (admin/owner only) |
| `/api/governance/audit-logs` | GET | List audit logs (filterable, paginated) |
| `/api/proposals` | GET/POST | List or create proposals |
| `/api/proposals/:id` | GET/PUT/DELETE | Manage a specific proposal |
| `/api/proposals/:id/submit` | POST | Submit proposal for review |
| `/api/proposals/:id/vote` | POST | Cast a vote |
| `/api/decisions` | GET | List decisions |
| `/api/decision-domains` | GET/POST | Manage decision domains |
| `/api/veto/:id` | POST/DELETE | Exercise or withdraw a veto |
| `/api/impact-reviews` | GET/POST | Manage impact reviews |

## Related

- [OpenPR Overview](/docs/plan/overview/) -- Architecture and database schema
- [AI Tasks](/docs/plan/ai-tasks/) -- How `vote_requested` tasks are dispatched to agents
- [Webhooks](/docs/plan/webhooks/) -- 9 governance webhook events
- [MCP Server](/docs/plan/mcp-server/) -- Proposal tools for AI agent integration
- [Architecture Overview](/docs/getting-started/architecture/) -- How governance fits in the pipeline
