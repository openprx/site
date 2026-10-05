---
title: "MCP Server"
description: "Sylvode's Model Context Protocol server exposes 140 tools for AI agents to manage projects, issues, forms, Flow objects, governance, and more."
sidebar:
  order: 2
---

The Sylvode MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io/) to give AI agents structured access to project management operations. Rather than screen-scraping a web UI or parsing API docs, agents interact through typed tool definitions with JSON Schema input validation.

## Transports

The MCP server supports three transport modes:

| Transport | Use Case | Command |
|-----------|----------|---------|
| **HTTP** | Remote agents, production deployments | `mcp-server serve --transport http --bind-addr 0.0.0.0:8090` |
| **stdio** | Local agents, IDE integrations | `mcp-server serve --transport stdio` |
| **SSE** | Browser-based agents, streaming | `mcp-server serve --transport sse` |

In the default Docker Compose deployment, the MCP server runs on port 8090 with HTTP transport.

## Authentication

The MCP server authenticates using **bot tokens** with the `opr_` prefix. These tokens are workspace-scoped and stored as SHA-256 hashes in the `workspace_bots` table.

Bot tokens support:

- Expiration dates (optional)
- Permission arrays (`read`, `write`, `admin`)
- Active/inactive status
- Automatic `last_used_at` tracking

### Configuration

The MCP server reads no environment variables. Its settings come from the `[mcp]` section of the TOML file named by `--config` (default `config/sylvode.toml`):

| Key | Description |
|-----|-------------|
| `api_url` | Base URL of the Sylvode API (default `http://localhost:8081`) |
| `bot_token` | Bot token (`opr_` prefix); required for `stdio` and the CLI subcommands, unused by `http`/`sse`, where each client sends its own token |
| `workspace_id` | UUID of the workspace to operate in (required) |
| `transport` | `stdio`, `http` or `sse` (default `stdio`) |
| `bind_addr` | Listen address for `http`/`sse` (default `127.0.0.1:8090`) |

```toml
[mcp]
bot_token = "opr_..."
workspace_id = "..."
```

## Tool Catalog

The MCP server exposes 140 tools. The total and the sorted-name hash are pinned in `apps/mcp-server/tool-registry-baseline.json` and checked against the live registry.

| Domain | Count |
|--------|------:|
| Universal forms & events | 34 |
| Flow | 30 |
| Work items | 11 |
| Scenario tools | 9 |
| Project types & resources | 6 |
| Projects | 5 |
| Labels | 5 |
| Plugins | 5 |
| Proposals & check results | 5 |
| Sprints | 4 |
| Comments | 3 |
| Context | 3 |
| Scenario templates | 3 |
| Operation records | 1 |
| Files, members, search, release readiness | 4 × 1 |

The sections below describe the core project-management tools. Use `tools/list` or the `list-tools` binary for the complete catalog with exact parameter schemas.

### Project Management (5 tools)

| Tool | Description |
|------|-------------|
| `projects.list` | List all projects in the workspace |
| `projects.get` | Get project details by UUID |
| `projects.create` | Create a new project with name and key |
| `projects.update` | Update project fields |
| `projects.delete` | Delete a project |

### Work Items / Issues (11 tools)

| Tool | Description |
|------|-------------|
| `work_items.list` | List issues in a project with optional filters (state, priority, assignee, sprint) |
| `work_items.get` | Get a single issue by UUID |
| `work_items.get_by_identifier` | Get an issue by its human-readable key (e.g., `PROJ-A1B2C3D4`) |
| `work_items.create` | Create a new issue with title, description, state, priority, assignee |
| `work_items.update` | Update issue fields (title, description, state, priority, assignee, sprint) |
| `work_items.delete` | Delete an issue |
| `work_items.search` | Full-text search across issue titles and descriptions |
| `work_items.add_label` | Add a single label to an issue |
| `work_items.add_labels` | Add multiple labels to an issue in one call |
| `work_items.remove_label` | Remove a label from an issue |
| `work_items.list_labels` | List all labels on an issue |

### Sprint Management (4 tools)

| Tool | Description |
|------|-------------|
| `sprints.create` | Create a sprint with name, start date, end date |
| `sprints.list` | List all sprints in a project |
| `sprints.update` | Update sprint fields (name, status, dates) |
| `sprints.delete` | Delete a sprint |

### Comments (3 tools)

| Tool | Description |
|------|-------------|
| `comments.list` | List comments on an issue |
| `comments.create` | Add a comment to an issue |
| `comments.delete` | Delete a comment |

### Labels (5 tools)

| Tool | Description |
|------|-------------|
| `labels.create` | Create a label with name and color |
| `labels.list` | List all labels in the workspace |
| `labels.list_by_project` | List labels scoped to a specific project |
| `labels.update` | Update label name or color |
| `labels.delete` | Delete a label |

### Governance / Proposals (4 tools)

| Tool | Description |
|------|-------------|
| `proposals.list` | List proposals for a project, optionally filtered by status |
| `proposals.get` | Get proposal details (supports both UUID and `PROP-` prefixed IDs) |
| `proposals.create` | Create a new proposal with title, description, and project |
| `proposals.create_from_result` | Create a governance proposal from a check result instead of directly applying a high-risk action |

### Members (1 tool)

| Tool | Description |
|------|-------------|
| `members.list` | List all members in the workspace |

### Files (1 tool)

| Tool | Description |
|------|-------------|
| `files.upload` | Upload a file attachment |

### Search (1 tool)

| Tool | Description |
|------|-------------|
| `search.all` | Global search across all entity types |

## Tool Input Schema

Every tool definition includes a JSON Schema for input validation. Parameters use UUID format for entity references and enforce required fields at the schema level.

Example: `work_items.create` input schema:

```json
{
  "type": "object",
  "properties": {
    "project_id": {
      "type": "string",
      "description": "UUID of the project",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    },
    "title": {
      "type": "string",
      "description": "Issue title"
    },
    "description": {
      "type": "string",
      "description": "Issue description (optional)"
    },
    "state": {
      "type": "string",
      "description": "Issue state: backlog, todo, in_progress, done"
    },
    "priority": {
      "type": "string",
      "description": "Priority: low, medium, high, urgent"
    },
    "assignee_id": {
      "type": "string",
      "description": "UUID of the assignee (optional)"
    }
  },
  "required": ["project_id", "title"]
}
```

## Tool Response Format

All tools return a `CallToolResult` with either a success payload (JSON-formatted data) or an error message string. Success responses contain the full entity representation as pretty-printed JSON.

## Connecting an AI Agent

### Claude Code / MCP Client Configuration

```json
{
  "mcpServers": {
    "sylvode": {
      "type": "http",
      "url": "http://localhost:8090/mcp/rpc",
      "headers": {
        "Authorization": "Bearer opr_your_bot_token_here"
      }
    }
  }
}
```

### stdio Transport (Local)

```json
{
  "mcpServers": {
    "sylvode": {
      "command": "/path/to/mcp-server",
      "args": ["serve", "--config", "/absolute/path/to/config/sylvode.toml"]
    }
  }
}
```

There is no `env` block: `api_url`, `bot_token` and `workspace_id` come from the `[mcp]` section of the file named by `--config`. Use an absolute path, because the default `config/sylvode.toml` is relative to whatever working directory the MCP client launches the process in.

## Listing Available Tools

The `mcp-server` package ships a `list-tools` binary that needs no running API:

```bash
# Print every tool name, description and input schema
cargo run --bin list-tools
```

This outputs every tool name, description, and input schema -- useful for debugging or generating client code.

## Related

- [Sylvode Overview](/plan/overview/) -- Architecture and deployment
- [AI Tasks](/plan/ai-tasks/) -- How tasks are dispatched to agents
- [Webhooks](/plan/webhooks/) -- Event-driven integration
- [Architecture Overview](/getting-started/architecture/) -- How MCP fits into the full pipeline
