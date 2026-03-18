---
title: "Build：代理流水线"
description: AI 代理如何被派发执行任务，以及知识如何跨会话持久化。
sidebar:
  order: 1
---

Build 阶段将项目管理（Plan）与实际代码生成连接起来。当 OpenPR 中的 Issue 被分配给机器人时，Build 层派发 AI 编码代理，管理其执行，并将结果反馈回项目。

## 核心组件

| 组件 | 角色 | 语言 |
|------|------|------|
| [openpr-webhook](/docs/build/webhook-dispatcher/) | 接收 OpenPR 事件，派发 AI 代理 | Rust (Axum) |
| [prx-memory](/docs/build/prx-memory/) | 代理的持久化知识存储（MCP 服务器） | Rust |

## 数据流

```
OpenPR 事件（issue.created / issue.updated）
    │
    ▼
openpr-webhook（HMAC-SHA256 验证）
    │
    ├── 过滤：这是机器人任务吗？
    │
    ▼
CLI 执行器
    │
    ├── 启动代理（codex、claude-code、opencode）
    ├── 从模板注入提示词
    ├── 设置工作目录、超时（900 秒）
    │
    ▼
AI 代理工作
    │
    ├── 阅读代码、进行修改、运行测试
    ├── 通过 prx-memory（MCP）存储/检索知识
    │
    ▼
回调（MCP / API）
    │
    ├── 将结果发布到 OpenPR
    ├── 状态变更：in_progress → done
    │
    ▼
OpenPR 更新 Issue
```

## 在流水线中的位置

Build 阶段位于 Think（AI 推理）和 Ship（分发）之间：

1. **Plan** 创建任务并分配给机器人用户
2. **Think** 提供模型路由和子代理编排
3. **Build** 派发编码代理并持久化学习到的模式
4. **Ship** 分发生成的产物
5. **Protect** 防护已部署的应用

## 代理生命周期

单个代理会话遵循以下生命周期：

1. **触发** -- OpenPR 触发 Webhook 事件（如带机器人指派人的 `issue.created`）
2. **派发** -- openpr-webhook 将事件匹配到代理配置并启动 CLI 执行器
3. **执行** -- 代理在沙箱工作目录中操作，有严格的超时限制
4. **记忆** -- 执行期间，代理调用 prx-memory MCP 工具回忆过去的解决方案并存储新知识
5. **汇报** -- 代理将结果（代码变更、测试结果、错误日志）发回 OpenPR
6. **关闭** -- OpenPR 根据结果转换 Issue 状态

## 快速开始

```bash
# 克隆并构建 Webhook 调度器
git clone https://github.com/openprx/openpr-webhook
cd openpr-webhook && cargo build --release

# 克隆并运行 prx-memory
git clone https://github.com/openprx/prx-memory
cd prx-memory && cargo run --release --features http
```

使用你的 OpenPR 实例 URL、Webhook 密钥和代理设置配置 Webhook 调度器。详见各组件文档了解配置详情。
