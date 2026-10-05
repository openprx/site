---
title: "MCP 服务器"
description: "Sylvode 的模型上下文协议服务器暴露 140 个工具，供 AI 代理管理项目、Issue、表单、Flow 对象、治理等。"
sidebar:
  order: 2
---

Sylvode MCP 服务器实现了[模型上下文协议](https://modelcontextprotocol.io/)，为 AI 代理提供对项目管理操作的结构化访问。代理无需爬取 Web UI 或解析 API 文档，而是通过带有 JSON Schema 输入验证的类型化工具定义进行交互。

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

MCP 服务器不读取任何环境变量，其设置来自 `--config` 指定的 TOML 文件（默认 `config/sylvode.toml`）中的 `[mcp]` 段：

| 键 | 说明 |
|----|------|
| `api_url` | Sylvode API 的基础 URL（默认 `http://localhost:8081`） |
| `bot_token` | 机器人令牌（`opr_` 前缀）；`stdio` 与 CLI 子命令必填，`http`/`sse` 不使用，由每个客户端发送自己的令牌 |
| `workspace_id` | 操作的工作区 UUID（必填） |
| `transport` | `stdio`、`http` 或 `sse`（默认 `stdio`） |
| `bind_addr` | `http`/`sse` 的监听地址（默认 `127.0.0.1:8090`） |

```toml
[mcp]
bot_token = "opr_..."
workspace_id = "..."
```

## 工具目录

MCP 服务器暴露 140 个工具。总数与排序后名称的哈希固定在 `apps/mcp-server/tool-registry-baseline.json` 中，并与运行时注册表核对。

| 领域 | 数量 |
|------|-----:|
| 通用表单与事件 | 34 |
| Flow | 30 |
| 工作项 | 11 |
| 场景工具 | 9 |
| 项目类型与资源 | 6 |
| 项目 | 5 |
| 标签 | 5 |
| 插件 | 5 |
| 提案与检查结果 | 5 |
| Sprint | 4 |
| 评论 | 3 |
| 上下文 | 3 |
| 场景模板 | 3 |
| 操作记录 | 1 |
| 文件、成员、搜索、发布就绪 | 4 × 1 |

以下各节介绍核心项目管理工具。完整目录及精确参数模式请使用 `tools/list` 或 `list-tools` 程序获取。

### 项目管理（5 个工具）

| 工具 | 说明 |
|------|------|
| `projects.list` | 列出工作区中的所有项目 |
| `projects.get` | 通过 UUID 获取项目详情 |
| `projects.create` | 创建新项目（指定名称和键） |
| `projects.update` | 更新项目字段 |
| `projects.delete` | 删除项目 |

### 工作项 / Issue（11 个工具）

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
| `labels.list_by_project` | 列出特定项目范围的标签 |
| `labels.update` | 更新标签名称或颜色 |
| `labels.delete` | 删除标签 |

### 治理 / 提案（4 个工具）

| 工具 | 说明 |
|------|------|
| `proposals.list` | 列出项目的提案，可按状态过滤 |
| `proposals.get` | 获取提案详情（支持 UUID 和 `PROP-` 前缀 ID） |
| `proposals.create` | 创建新提案（指定标题、描述和项目） |
| `proposals.create_from_result` | 基于检查结果创建治理提案，而不是直接执行高风险操作 |

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

### stdio 传输（本地）

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

没有 `env` 块：`api_url`、`bot_token` 和 `workspace_id` 来自 `--config` 指定文件的 `[mcp]` 段。请使用绝对路径，因为默认的 `config/sylvode.toml` 相对于 MCP 客户端启动进程时的工作目录。

## 列出可用工具

`mcp-server` 包附带一个无需运行 API 的 `list-tools` 程序：

```bash
# 打印每个工具的名称、描述和输入模式
cargo run --bin list-tools
```

这将输出每个工具的名称、描述和输入模式——便于调试或生成客户端代码。

## 相关文档

- [Sylvode 概览](/zh/plan/overview/) -- 架构和部署
- [AI 任务](/zh/plan/ai-tasks/) -- 任务如何派发给代理
- [Webhooks](/zh/plan/webhooks/) -- 事件驱动集成
- [架构概览](/zh/getting-started/architecture/) -- MCP 在完整流水线中的位置
