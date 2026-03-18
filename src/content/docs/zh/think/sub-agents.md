---
title: 子代理
description: PRX 通过三层系统委派工作——同步命名代理、异步即发即忘会话和管理命令——以及 MCP 客户端和远程节点。
sidebar:
  order: 5
---

PRX 不是一个单线程的对话代理。它通过结构化的子代理层次来委派工作，每种子代理有不同的执行模型、生命周期保证和监督级别。

## 三层委派

### 第一层：Delegate（同步）

`delegate` 命令将任务派发给一个**命名代理**，并等待结果后再继续。这是同步的、阻塞式委派。

```
PRX 主进程 ──delegate("coder", task)──→ 代理 "coder"
            │                            │
            │（阻塞中，等待）              │（工作中...）
            │                            │
            ◀── 结果 ─────────────────┘
```

**关键特性：**

- **命名代理** — 每个代理有名称、系统提示词，可选专用模型
- **代理模式** — 被委派的代理运行完整的工具循环（观察、思考、行动、重复）直到任务完成
- **深度控制** — 委派深度有限制（默认：3 层），防止无限递归。代理 A 可以委派给代理 B，B 可以委派给代理 C，但 C 不能再委派
- **上下文隔离** — 每个被委派的代理有自己的对话上下文；它看不到父级的完整历史，只有任务描述

```toml
[agents.coder]
system_prompt = "You are a coding agent. Write clean, tested code."
model = "anthropic/claude-sonnet-4-20250514"
tools = ["read_file", "write_file", "bash", "grep"]
max_depth = 3
```

### 第二层：Sessions Spawn（异步即发即忘）

`sessions_spawn` 命令异步启动代理。父进程不等待——它立即收到一个**运行 ID** 并继续处理。

```
PRX 主进程 ──sessions_spawn(task)──→ 返回 run_id="abc123"
            │                          │
            │（继续工作）                │ 派生会话（独立运行）
            │                          │
            │                          └──→ 完成时：自动通知结果
```

**关键特性：**

- **即发即忘** — 调用方获得运行 ID 后继续
- **自动通知** — 派生会话完成时，将结果自动通知到原始通道
- **引导** — 父进程（或用户）可以使用运行 ID 向正在运行的会话发送后续指令
- **终止** — 可以通过运行 ID 终止正在运行的会话

这对长时间运行的任务很有用："去研究这个课题，完成后报告"，而主代理继续回答其他问题。

### 第三层：子代理管理

用于检查和控制运行中子代理的管理命令：

| 命令 | 说明 |
|------|------|
| `subagents list` | 列出所有活跃的子代理会话及其运行 ID、状态和已用时间 |
| `subagents kill <run_id>` | 终止一个运行中的子代理会话 |
| `subagents steer <run_id> <instruction>` | 向运行中的会话发送后续指令，重定向其行为 |

这为操作者提供了对后台自主工作的可见性和控制权。

## MCP 客户端

PRX 内置 **MCP（模型上下文协议）客户端**，用于连接外部 MCP 服务器并使用其工具。

```toml
[mcp_servers.memory]
transport = "http"
url = "http://localhost:8082/mcp"

[mcp_servers.filesystem]
transport = "stdio"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
```

**支持的传输方式：**

| 传输方式 | 说明 |
|----------|------|
| HTTP | 通过 HTTP/SSE 连接 MCP 服务器 |
| stdio | 启动子进程，通过 stdin/stdout 通信 |

当配置了 MCP 服务器时，其工具对 PRX 和所有子代理可用。工具调用通过 MCP 客户端透明路由——LLM 将它们视为原生工具。

这是 PRX 连接以下服务的方式：
- **prx-memory** 用于持久化知识存储和检索
- **OpenPR** 用于项目管理操作（创建 Issue、更新状态）
- **文件系统服务器** 用于沙箱化的文件访问
- 任何第三方 MCP 兼容服务器

## 远程节点

PRX 通过**远程节点**（`prx-node`）支持分布式执行，允许将工作委派到其他机器。

### 架构

```
PRX 守护进程（中心）
  │
  ├── H2 传输 ──→ prx-node（服务器 A）
  ├── H2 传输 ──→ prx-node（笔记本 B）
  └── H2 传输 ──→ prx-node（GPU 服务器 C）
```

### 设备配对

远程节点通过配对协议进行认证：

1. 远程节点生成配对码
2. 操作者在中心 PRX 实例上输入配对码
3. 建立共享密钥用于后续通信
4. 所有后续流量通过 H2（HTTP/2）加密

### 使用场景

- **GPU 卸载** — 将推理路由到运行 Ollama 或 vLLM 的 GPU 机器
- **平台特定任务** — 将 macOS 任务委派给 Mac 节点，Windows 任务委派给 Windows 节点
- **地理分布** — 在不同区域运行节点以降低到本地服务的延迟
- **隔离** — 在具有有限访问权限的专用节点上运行不受信任的工具执行

```toml
[remote_nodes.gpu_server]
address = "192.168.1.100:9090"
paired = true
capabilities = ["gpu", "ollama"]
```

子代理可以显式路由到远程节点，路由器也可以在做委派决策时考虑节点能力。
