---
title: prx-memory
description: "AI 代理的持久化知识存储，作为 MCP 服务器暴露，支持混合检索和自我进化。"
sidebar:
  order: 3
---

prx-memory 是一个 Rust MCP 服务器，为 AI 代理提供持久化、可搜索的记忆。代理在任务执行期间存储学习成果，并在未来会话中检索它们，实现整个流水线的知识积累。

## 传输方式

prx-memory 支持两种 MCP 传输方式：

| 传输方式 | 使用场景 |
|----------|----------|
| **stdio** | 与 CLI 代理直接集成（claude-code、codex） |
| **HTTP** | 多代理部署的网络可访问服务器（需要 `--features http`） |

## MCP 工具

prx-memory 暴露 14 个 MCP 工具：

### 核心操作

| 工具 | 说明 |
|------|------|
| `store` | 存储新的记忆条目，包含内容、标签和重要性分数 |
| `recall` | 通过语义相似度、关键词匹配或标签过滤检索记忆 |
| `update` | 修改现有记忆的内容、标签或重要性 |
| `forget` | 软删除记忆（可恢复） |
| `list` | 列出记忆，支持分页和过滤 |
| `stats` | 返回记忆存储统计（数量、标签分布、存储大小） |

### 批量操作

| 工具 | 说明 |
|------|------|
| `store_dual` | 存储同时包含简洁摘要和完整内容的记忆 |
| `export` | 将所有记忆导出为 JSON 用于备份或迁移 |
| `import` | 从 JSON 导出导入记忆 |
| `migrate` | 将记忆存储模式迁移到新版本 |

### 高级操作

| 工具 | 说明 |
|------|------|
| `reembed` | 为所有记忆重新生成嵌入（切换嵌入供应商后） |
| `compact` | 合并重复或近似重复的记忆以减小存储大小 |
| `evolve` | 触发 MSES 自我进化周期（见下文） |
| `skill_manifest` | 返回所有工具及其参数的结构化清单 |

## 混合检索

当代理调用 `recall` 时，prx-memory 运行多信号检索流水线：

```
查询
  │
  ├── BM25 关键词搜索（稀疏）
  ├── 嵌入余弦相似度（稠密）
  │
  ▼
分数融合
  │
  ├── 时效性加成（较新的记忆得分更高）
  ├── 重要性加权（用户设定的重要性）
  ├── 去重（近似重复抑制）
  │
  ▼
可选重排序
  │
  ▼
Top-K 结果
```

### 重排序供应商

启用后，检索到的候选项由专用模型重新排序以提高精确度：

| 供应商 | 备注 |
|--------|------|
| Jina Reranker | Jina AI 重排序 API |
| Cohere Rerank | Cohere 的重排序端点 |
| Pinecone Rerank | Pinecone 的推理 API |

重排序是可选的，默认禁用。当检索精确度比延迟更重要时启用。

## 嵌入供应商

prx-memory 为语义搜索生成向量嵌入。支持的供应商：

| 供应商 | 模型 | 备注 |
|--------|------|------|
| OpenAI 兼容 | `text-embedding-3-small`、`text-embedding-3-large` 或任何兼容端点 | 默认；支持 OpenAI、Azure、本地服务器 |
| Jina | `jina-embeddings-v3` | Jina AI 的嵌入 API |
| Gemini | `text-embedding-004` | Google 的嵌入模型 |

在配置文件中配置供应商和模型。如果切换供应商，运行 `reembed` 工具为所有现有嵌入重新生成。

## 自我进化（MSES）

记忆自我进化系统（MSES）自动优化检索参数：

1. **候选选择** -- 选择要进化的参数（如 BM25 权重、时效性衰减、相似度阈值）
2. **训练集评分** -- 在已知优质的查询/结果对训练集上评估候选
3. **留出集评分** -- 在留出的测试集上验证最佳候选以防止过拟合
4. **应用或拒绝** -- 如果留出集分数提高，采用新参数；否则保留当前值

通过 `evolve` MCP 工具手动触发进化，或配置定期运行。

## 治理

prx-memory 包含多代理和多团队部署的治理控制：

### 标准化配置文件

定义所有存储记忆必须遵循的命名约定和内容标准。违反活动配置文件的记忆会被拒绝或自动修正。

### 标签分类法

强制记忆标签使用受控词汇。自由格式标签可以自动映射到规范标签。

### 比例约束

设置记忆类别的最小和最大比例（如"至少 10% 的记忆必须是错误模式"，"不超过 50% 可以是代码片段"）。这防止存储被单一类别主导。

### 范围 ACL

控制哪些代理或用户可以读取/写入特定的记忆范围。范围对记忆存储进行分区，使项目特定的知识不会跨边界泄露。

## 配置

```toml
[storage]
path = "~/.prx-memory/store.db"

[embedding]
provider = "openai"
model = "text-embedding-3-small"
api_key_env = "OPENAI_API_KEY"

[retrieval]
bm25_weight = 0.3
semantic_weight = 0.7
recency_half_life_days = 30
top_k = 10

[reranker]
enabled = false
provider = "jina"

[evolution]
enabled = false
schedule = "weekly"
```

## 运行

```bash
# stdio 模式（用于直接代理集成）
cargo run --release

# HTTP 模式（网络可访问）
cargo run --release --features http

# 使用自定义配置
cargo run --release -- --config /etc/prx-memory/config.toml
```
