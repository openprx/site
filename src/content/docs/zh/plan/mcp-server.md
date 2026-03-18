---
title: "MCP 服务器"
description: "OpenPR 的模型上下文协议服务器暴露 34 个工具，供 AI 代理管理项目、Issue、Sprint、标签、提案等。"
sidebar:
  order: 2
---

OpenPR MCP 服务器实现了[模型上下文协议](https://modelcontextprotocol.io/)，为 AI 代理提供对项目管理操作的结构化访问。代理无需爬取 Web UI 或解析 API 文档，而是通过带有 JSON Schema 输入验证的类型化工具定义进行交互。

## 传输方式

MCP 服务器支持三种传输模式：

| 传输方式 | 使用场景 | 命令 |
|----------|----------|------|
| **HTTP** | 远程代理、生产部署 | `mcp-server serve --transport http --bind-addr 0.0.0.0:8090` |
| **stdio** | 本地代理、IDE 集成 | `mcp-server serve --transport stdio` |
| **SSE** | 基于浏览器的代理、流式传输 | `mcp-server serve --transport sse` |

在默认的 Docker Compose 部署中，MCP 服务器以 HTTP 传输方式运行在 8090 端口。

## 认证

MCP 服务器使用带 `opr_` 前缀的**机器人令牌**进行认证。这些令牌具有工作区范围，以 SHA-256 哈希形式存储在 `workspace_bots` 表中。

机器人令牌支持：

- 过期日期（可选）
- 权限数组（`read`、`write`、`admin`）
- 启用/禁用状态
- 自动 `last_used_at` 跟踪

### 配置

MCP 服务器需要以下环境变量：

| 变量 | 说明 |
|------|------|
| `OPENPR_API_URL` | OpenPR API 的基础 URL |
| `OPENPR_BOT_TOKEN` | 机器人令牌（`opr_` 前缀），用于认证 |
| `OPENPR_WORKSPACE_ID` | 操作的工作区 UUID |
| `DEFAULT_AUTHOR_ID` | 未指定作者时的默认用户 ID |

## 工具目录

MCP 服务器暴露 34 个工具，按以下类别组织。

### 项目管理（5 个工具）

| 工具 | 说明 |
|------|------|
| `projects.list` | 列出工作区中的所有项目 |
| `projects.get` | 通过 UUID 获取项目详情 |
| `projects.create` | 创建新项目（指定名称和键） |
| `projects.update` | 更新项目字段 |
| `projects.delete` | 删除项目 |

### 工作项 / Issue（10 个工具）

| 工具 | 说明 |
|------|------|
| `work_items.list` | 列出项目中的 Issue，支持可选过滤（状态、优先级、指派人、Sprint） |
| `work_items.get` | 通过 UUID 获取单个 Issue |
| `work_items.get_by_identifier` | 通过可读标识获取 Issue（如 `PROJ-A1B2C3D4`） |
| `work_items.create` | 创建新 Issue（指定标题、描述、状态、优先级、指派人） |
| `work_items.update` | 更新 Issue 字段（标题、描述、状态、优先级、指派人、Sprint） |
| `work_items.delete` | 删除 Issue |
| `work_items.search` | 全文搜索 Issue 标题和描述 |
| `work_items.add_label` | 为 Issue 添加单个标签 |
| `work_items.add_labels` | 一次为 Issue 添加多个标签 |
| `work_items.remove_label` | 从 Issue 移除标签 |
| `work_items.list_labels` | 列出 Issue 上的所有标签 |

### Sprint 管理（4 个工具）

| 工具 | 说明 |
|------|------|
| `sprints.create` | 创建 Sprint（指定名称、开始日期、结束日期） |
| `sprints.list` | 列出项目中的所有 Sprint |
| `sprints.update` | 更新 Sprint 字段（名称、状态、日期） |
| `sprints.delete` | 删除 Sprint |

### 评论（3 个工具）

| 工具 | 说明 |
|------|------|
| `comments.list` | 列出 Issue 上的评论 |
| `comments.create` | 为 Issue 添加评论 |
| `comments.delete` | 删除评论 |

### 标签（5 个工具）

| 工具 | 说明 |
|------|------|
| `labels.create` | 创建标签（指定名称和颜色） |
| `labels.list` | 列出工作区中的所有标签 |
| `labels.list_project` | 列出特定项目范围的标签 |
| `labels.update` | 更新标签名称或颜色 |
| `labels.delete` | 删除标签 |

### 治理 / 提案（3 个工具）

| 工具 | 说明 |
|------|------|
| `proposals.list` | 列出项目的提案，可按状态过滤 |
| `proposals.get` | 获取提案详情（支持 UUID 和 `PROP-` 前缀 ID） |
| `proposals.create` | 创建新提案（指定标题、描述和项目） |

### 成员（1 个工具）

| 工具 | 说明 |
|------|------|
| `members.list` | 列出工作区中的所有成员 |

### 文件（1 个工具）

| 工具 | 说明 |
|------|------|
| `files.upload` | 上传文件附件 |

### 搜索（1 个工具）

| 工具 | 说明 |
|------|------|
| `search.all` | 跨所有实体类型的全局搜索 |

## 工具输入模式

每个工具定义都包含用于输入验证的 JSON Schema。参数对实体引用使用 UUID 格式，并在模式层面强制必填字段。

示例：`work_items.create` 输入模式：

```json
{
  "type": "object",
  "properties": {
    "project_id": {
      "type": "string",
      "description": "项目 UUID",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    },
    "title": {
      "type": "string",
      "description": "Issue 标题"
    },
    "description": {
      "type": "string",
      "description": "Issue 描述（可选）"
    },
    "state": {
      "type": "string",
      "description": "Issue 状态：backlog、todo、in_progress、done"
    },
    "priority": {
      "type": "string",
      "description": "优先级：low、medium、high、urgent"
    },
    "assignee_id": {
      "type": "string",
      "description": "指派人 UUID（可选）"
    }
  },
  "required": ["project_id", "title"]
}
```

## 工具响应格式

所有工具返回一个 `CallToolResult`，包含成功载荷（JSON 格式数据）或错误消息字符串。成功响应包含格式化的完整实体 JSON 表示。

## 连接 AI 代理

### Claude Code / MCP 客户端配置

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

### stdio 传输（本地）

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

## 列出可用工具

MCP 服务器内置工具列表功能：

```bash
# 以 JSON 格式打印所有工具定义
mcp-server list-tools
```

这将输出每个工具的名称、描述和输入模式——便于调试或生成客户端代码。

## 相关文档

- [OpenPR 概览](/docs/plan/overview/) -- 架构和部署
- [AI 任务](/docs/plan/ai-tasks/) -- 任务如何派发给代理
- [Webhooks](/docs/plan/webhooks/) -- 事件驱动集成
- [架构概览](/docs/getting-started/architecture/) -- MCP 在完整流水线中的位置
