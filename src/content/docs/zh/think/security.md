---
title: 安全策略
description: PRX 执行 5 层安全策略流水线，包含自治级别、审批工作流，以及通过 Docker、Firejail、Bubblewrap、Landlock 和 WASM 的沙箱执行。
sidebar:
  order: 7
---

PRX 中的安全不是事后附加到代理循环上的。它是一个结构性组件——一个 5 层策略流水线，管控每个代理、工具和插件可以做什么。

## SecurityPolicy 结构体

核心策略由 `SecurityPolicy` 结构体定义：

```rust
pub struct SecurityPolicy {
    pub autonomy: AutonomyLevel,
    pub workspace_restrictions: Vec<PathBuf>,
    pub allowed_commands: Vec<String>,
    pub forbidden_paths: Vec<PathBuf>,
    pub rate_limits: RateLimits,
    pub cost_limits: CostLimits,
}
```

### 自治级别

| 级别 | 行为 |
|------|------|
| `ReadOnly` | 代理可以读取文件和调用 LLM，但不能执行命令、写入文件或修改状态 |
| `Supervised` | 代理可以提议操作，但必须获得人类批准后才能执行 |
| `Full` | 代理可以在策略范围内自主执行操作 |

### 工作区限制

限制代理可以访问的文件系统路径：

```toml
workspace_restrictions = ["/home/user/project", "/tmp/workspace"]
```

这些路径之外的任何文件操作都会被拒绝，不论自治级别。

### 允许的命令

代理可以执行的 Shell 命令显式白名单：

```toml
allowed_commands = ["git", "cargo", "npm", "python", "ls", "cat", "grep"]
```

不在此列表中的命令会被阻止。不支持通配符——每个允许的命令必须明确列出。

### 禁止路径

始终被拒绝的路径，即使它们位于允许的工作区内：

```toml
forbidden_paths = ["/home/user/project/.env", "/home/user/project/secrets/"]
```

### 速率限制

控制请求频率：

```toml
[rate_limits]
requests_per_minute = 60
requests_per_hour = 500
max_concurrent = 4
```

### 费用限制

限制 LLM API 调用的支出：

```toml
[cost_limits]
max_per_request_usd = 1.00
max_per_hour_usd = 10.00
max_per_day_usd = 50.00
```

当达到费用限制时，进一步的 LLM 调用将被阻止，直到窗口重置。

## 5 层策略流水线

策略按分层层次结构评估。每一层可以限制（但不能扩展）上一层授予的权限。

```
┌──────────────────────────────┐
│  第 1 层：全局策略            │  系统范围默认值
├──────────────────────────────┤
│  第 2 层：配置文件策略         │  每用户或每角色覆盖
├──────────────────────────────┤
│  第 3 层：代理策略            │  每命名代理限制
├──────────────────────────────┤
│  第 4 层：群组策略            │  每通道群组限制
├──────────────────────────────┤
│  第 5 层：工具策略            │  每工具限制
└──────────────────────────────┘
```

| 层级 | 范围 | 示例 |
|------|------|------|
| 全局 | 所有代理、所有通道 | `autonomy = Supervised`，`max_per_day_usd = 100` |
| 配置文件 | 特定用户或角色 | 管理员配置文件获得 `autonomy = Full`；访客配置文件保持 `ReadOnly` |
| 代理 | 命名代理（如 "coder"） | 编码代理获得 `allowed_commands = ["git", "cargo"]`，研究代理不获得 |
| 群组 | 通道群组（如特定 Telegram 群组） | 公共群组强制为 `ReadOnly` |
| 工具 | 单个工具（如 "bash"） | Bash 工具获得额外的 `forbidden_paths`，更严格的 `rate_limits` |

任何操作的有效策略是所有适用层级的**交集**。如果任一层级拒绝操作，则该操作被拒绝。

## 审批工作流

当 `autonomy = Supervised` 时，代理不能直接执行操作。而是：

1. 代理提议一个操作（如 "运行 `cargo test`"）
2. PRX 格式化提议并发送到监督通道
3. 监督者（人类）审查并回应：批准、拒绝或修改
4. 如果批准，PRX 执行操作并将结果返回给代理
5. 如果拒绝，代理收到拒绝消息并必须寻找替代方案

审批请求包含：
- 提议的确切命令或操作
- 代理名称和上下文
- 要求审批的安全策略层级
- 超时（默认：5 分钟），超时后操作自动拒绝

## 沙箱

PRX 支持多种沙箱后端来隔离工具执行。沙箱根据平台可用性和配置选择。

### Docker

完整的容器隔离。命令在一次性 Docker 容器中运行：
- 挂载的工作区目录（按策略只读或读写）
- 无网络访问（除非明确允许）
- 资源限制（CPU、内存、时间）
- 删除特权能力

```toml
[sandbox]
backend = "docker"
image = "prx-sandbox:latest"
network = false
memory_limit = "512m"
cpu_limit = "1.0"
timeout_seconds = 300
```

### Firejail

使用命名空间和 seccomp 的轻量级 Linux 沙箱：
- 文件系统白名单
- 网络过滤
- Seccomp 系统调用过滤
- 无需 root 权限

```toml
[sandbox]
backend = "firejail"
whitelist = ["/home/user/project"]
net = "none"
```

### Bubblewrap (bwrap)

Flatpak 使用的最小非特权沙箱：
- 挂载命名空间隔离
- PID 命名空间隔离
- 仅绑定挂载指定目录
- 删除所有特权能力

```toml
[sandbox]
backend = "bubblewrap"
bind_rw = ["/home/user/project"]
bind_ro = ["/usr", "/lib", "/bin"]
unshare_net = true
```

### Landlock

用于细粒度文件系统访问控制的 Linux 安全模块：
- 在内核层面限制文件访问
- 无容器开销
- 适用于非特权进程
- 需要 Linux 5.13+

```toml
[sandbox]
backend = "landlock"
allowed_read = ["/home/user/project", "/usr/lib"]
allowed_write = ["/home/user/project/output"]
```

### 沙箱选择

PRX 自动检测可用后端并选择最强的：

```
Docker > Bubblewrap > Firejail > Landlock > None
```

如果没有可用的沙箱后端且策略要求沙箱，则工具执行被拒绝。

## WASM 插件沙箱

PRX 插件编译为 WASM 并在 **wasmtime** 沙箱中执行：

- 内存隔离：每个插件有自己的线性内存
- 除非通过 WASI 明确授予，否则无文件系统访问
- 除非明确授予，否则无网络访问
- 通过 wasmtime 燃料计量强制 CPU 时间限制
- 插件无法访问 PRX 内部——它们通过定义的宿主 API 进行通信

```toml
[plugins.my_plugin]
path = "plugins/my_plugin.wasm"
permissions = ["fs:read:/data", "net:https://api.example.com"]
fuel_limit = 1_000_000
```

这确保了第三方或用户编写的插件不能危害宿主系统、泄露数据或消耗无限资源。
