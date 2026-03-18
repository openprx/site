---
title: "MCP Server"
description: "OpenPR's Model Context Protocol server exposes 34 tools for AI agents to manage projects, issues, sprints, labels, proposals, and more."
sidebar:
  order: 2
---

The OpenPR MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io/) to give AI agents structured access to project management operations. Rather than screen-scraping a web UI or parsing API docs, agents interact through typed tool definitions with JSON Schema input validation.

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

The MCP server requires these environment variables:

| Variable | Description |
|----------|-------------|
| `OPENPR_API_URL` | Base URL of the OpenPR API |
| `OPENPR_BOT_TOKEN` | Bot token (`opr_` prefix) for authentication |
| `OPENPR_WORKSPACE_ID` | UUID of the workspace to operate in |
| `DEFAULT_AUTHOR_ID` | Default user ID for operations without explicit author |

## Tool Catalog

The MCP server exposes 34 tools organized into the following categories.

### Project Management (5 tools)

| Tool | Description |
|------|-------------|
| `projects.list` | List all projects in the workspace |
| `projects.get` | Get project details by UUID |
| `projects.create` | Create a new project with name and key |
| `projects.update` | Update project fields |
| `projects.delete` | Delete a project |

### Work Items / Issues (10 tools)

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
| `labels.list_project` | List labels scoped to a specific project |
| `labels.update` | Update label name or color |
| `labels.delete` | Delete a label |

### Governance / Proposals (3 tools)

| Tool | Description |
|------|-------------|
| `proposals.list` | List proposals for a project, optionally filtered by status |
| `proposals.get` | Get proposal details (supports both UUID and `PROP-` prefixed IDs) |
| `proposals.create` | Create a new proposal with title, description, and project |

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
    "openpr": {
      "url": "http://localhost:8090/mcp",
      "transport": "http",
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
    "openpr": {
      "command": "/path/to/mcp-server",
      "args": ["serve", "--transport", "stdio"],
      "env": {
        "OPENPR_API_URL": "http://localhost:8081",
        "OPENPR_BOT_TOKEN": "opr_your_bot_token_here",
        "OPENPR_WORKSPACE_ID": "your-workspace-uuid"
      }
    }
  }
}
```

## Listing Available Tools

The MCP server includes a built-in tool listing utility:

```bash
# Print all tool definitions as JSON
mcp-server list-tools
```

This outputs every tool name, description, and input schema -- useful for debugging or generating client code.

## Related

- [OpenPR Overview](/docs/plan/overview/) -- Architecture and deployment
- [AI Tasks](/docs/plan/ai-tasks/) -- How tasks are dispatched to agents
- [Webhooks](/docs/plan/webhooks/) -- Event-driven integration
- [Architecture Overview](/docs/getting-started/architecture/) -- How MCP fits into the full pipeline
