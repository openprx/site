---
title: PRX-SD
description: "11-crate Rust 杀毒引擎，集成哈希匹配、YARA 规则、启发式分析、ML 推理和实时文件监控。"
sidebar:
  order: 3
---

PRX-SD 是一个开源杀毒引擎，构建为 11-crate Rust 工作区。它结合传统的签名检测与启发式分析和机器学习，在 Linux、macOS 和 Windows 端点上识别恶意软件。

## 架构

| Crate | 角色 |
|-------|------|
| `prx-sd-core` | 共享类型、配置、评分、错误处理 |
| `prx-sd-scanner` | 编排 5 阶段检测流水线 |
| `prx-sd-signatures` | 哈希数据库（LMDB）和签名管理 |
| `prx-sd-yara` | YARA 规则编译和匹配 |
| `prx-sd-heuristics` | 熵分析、加壳检测、可疑 API/行为模式 |
| `prx-sd-ml` | 通过 ONNX Runtime / tract 的 ML 推理 |
| `prx-sd-quarantine` | AES-256-GCM 加密保险库，用于隔离威胁 |
| `prx-sd-sandbox` | 进程沙箱（ptrace、seccomp、命名空间、Landlock） |
| `prx-sd-monitor` | 实时文件系统监控 |
| `prx-sd-cli` | 命令行界面（`sd`） |
| `prx-sd-gui` | 桌面 GUI（Tauri + Vue 3） |

## 5 阶段检测流水线

每个被扫描的文件通过这些阶段。任何阶段的检测都可以短路并给出最终裁决。

```
文件输入
  │
  ▼
1. 哈希匹配 ──命中──▶ 恶意（即时）
  │ 未命中
  ▼
2. 文件类型检测（魔数字节）
  │
  ▼
3. 格式解析（PE / ELF / MachO / PDF / Office）
  │
  ▼
4. 并行分析
  │
  ├── YARA 规则扫描 ──命中──▶ 恶意
  ├── 启发式引擎 ──评分──▶ 已评分
  └── ML 推理（ONNX/tract）──评分──▶ 已评分
  │
  ▼
5. VirusTotal 云查询（可选）
  │
  ▼
聚合 → 最终裁决
```

### 阶段 1：哈希匹配

最快的检测方法。文件 SHA-256（和可选的 MD5）在 LMDB 数据库中以 O(1) 时间查找。

**签名来源：**

| 来源 | 类型 | 内容 |
|------|------|------|
| abuse.ch MalwareBazaar | SHA-256 | 最近 48 小时的恶意软件样本 |
| abuse.ch URLhaus | SHA-256 | 恶意 URL 关联的文件哈希 |
| abuse.ch Feodo Tracker | SHA-256 | 银行木马（Emotet、Dridex、TrickBot） |
| VirusShare | MD5 | 2000 万+ 恶意软件哈希（完整模式） |
| ClamAV | 多种 | .cvd/.ndb 签名（已含解析器） |
| 内置黑名单 | SHA-256 | EICAR、WannaCry、NotPetya、Emotet 等 |

### 阶段 2：文件类型检测

通过魔数字节识别确定文件的真实类型，不受扩展名影响：PE、ELF、MachO、PDF、ZIP、Office（OLE/OOXML）。

### 阶段 3：格式解析

对已识别格式进行深度解析，提取启发式引擎使用的结构化元数据：

| 格式 | 提取的数据 |
|------|-----------|
| PE (Windows) | 节、导入、导出、资源、时间戳、数字签名 |
| ELF (Linux) | 节、符号、动态链接、解释器路径 |
| MachO (macOS) | 加载命令、dylib 依赖、权限声明、代码签名 |
| PDF | JavaScript、嵌入文件、启动操作、URI 操作 |
| Office | 宏（VBA）、OLE 流、DDE 链接、嵌入对象 |

### 阶段 4：并行分析

三个分析引擎在解析后的文件上并发运行：

**YARA 规则** -- 对 38,800+ 条规则进行模式匹配，来自多个来源（内置、Yara-Rules、Neo23x0/signature-base、ReversingLabs、ESET、InQuest）。

**启发式引擎** -- 基于结构异常对文件评分：

| 检查项 | 适用于 | 检测内容 |
|--------|--------|----------|
| 节熵值 | PE、ELF、MachO | 加壳或加密的节（高熵） |
| 加壳检测 | PE | 已知的加壳器（UPX、Themida、VMProtect） |
| 可疑 API 导入 | PE | 进程注入、键盘记录、加密、反调试 |
| LD_PRELOAD 钩子 | ELF | 共享库注入 |
| cron/systemd 持久化 | ELF | 持久化机制 |
| SSH 后门指标 | ELF | 未授权的 SSH 密钥注入 |
| dylib 注入 | MachO | 动态库劫持 |
| LaunchAgent/Daemon | MachO | macOS 持久化机制 |
| 钥匙串访问 | MachO | 凭据窃取指标 |
| 时间戳异常 | PE | 伪造的编译时间戳 |

**ML 推理** -- 通过 ONNX Runtime 或 tract 的机器学习分类。模型基于解析阶段提取的特征对文件评分。

### 阶段 5：VirusTotal 云查询（可选）

如果启用，文件哈希将在 VirusTotal 的数据库中查询以获取其他引擎的检测结果。

## 评分

所有分析结果聚合为一个数值分数：

| 分数范围 | 裁决 | 含义 |
|----------|------|------|
| 0--29 | 安全 | 未检测到威胁 |
| 30--69 | 可疑 | 存在一些指标，建议人工审查 |
| 70--100 | 恶意 | 高置信度威胁，建议自动处理 |

最终裁决使用任何检测阶段的最高严重程度。

## 实时监控

PRX-SD 使用平台原生 API 实时监控文件系统变更：

| 平台 | API |
|------|-----|
| Linux | fanotify |
| macOS | FSEvents |
| Windows | ReadDirectoryChangesW |

当检测到新文件或修改的文件时，自动通过完整流水线进行扫描。

### 勒索软件检测

监控包含专门的勒索软件检测：快速的文件重命名/加密模式、已知的勒索软件扩展名和高熵批量写入会触发即时告警。

## 隔离区

检测到的威胁被移入 **AES-256-GCM 加密保险库**：

- 文件在存储前加密，防止意外执行
- 保留原始路径和元数据以供恢复
- 隔离的文件可以通过 CLI 列出、检查或恢复

```bash
# 列出隔离的文件
sd quarantine list

# 恢复隔离的文件
sd quarantine restore <ID>

# 永久删除隔离的文件
sd quarantine delete <ID>
```

## 修复

除隔离外，PRX-SD 还可以采取主动修复措施：

| 操作 | 说明 |
|------|------|
| 终止进程 | 终止创建或使用恶意文件的进程 |
| 清理持久化 | 移除与威胁关联的 cron 任务、systemd 单元、LaunchAgent 或注册表项 |
| 网络隔离 | 阻止受感染进程或主机的出站连接 |

## 沙箱

PRX-SD 可以在受限沙箱中执行可疑文件进行行为分析：

| 机制 | 平台 | 用途 |
|------|------|------|
| ptrace | Linux | 系统调用追踪 |
| seccomp | Linux | 系统调用过滤 |
| 命名空间 | Linux | 文件系统和网络隔离 |
| Landlock | Linux 5.13+ | 文件系统访问限制 |

### 行为规则

沙箱监控 10 类可疑行为：

1. 文件加密（高熵批量写入）
2. 进程注入（ptrace 附加、`/proc/*/mem` 写入）
3. 凭据访问（读取 `/etc/shadow`、钥匙串、浏览器存储）
4. 网络信标（向未知主机的周期性出站连接）
5. 持久化安装（cron、systemd、LaunchAgent、注册表）
6. 权限提升（setuid、sudo、capability 操作）
7. 反分析（调试器检测、虚拟机检测、睡眠规避）
8. 数据外泄（大量出站传输、DNS 隧道）
9. 横向移动（SSH、SMB、WMI 活动）
10. 防御规避（日志删除、时间戳篡改、二进制加壳）

## CLI 命令

```bash
# 扫描单个文件
sd scan /path/to/file

# 递归扫描目录
sd scan /home --recursive

# 扫描并自动隔离
sd scan /tmp --auto-quarantine

# JSON 输出用于程序化使用
sd scan /path --json

# 实时目录监控
sd monitor /home /tmp

# 更新签名数据库
sd update

# 导入自定义哈希
sd import my_hashes.txt

# 显示数据库和引擎信息
sd info
```

## Webhook 告警

PRX-SD 通过 Webhook 向外部服务发送检测告警：

| 格式 | 端点 |
|------|------|
| Slack | Incoming Webhook URL |
| Discord | Webhook URL |
| 通用 JSON | 任何 HTTP 端点 |

告警载荷包含：文件路径、SHA-256 哈希、匹配的规则/签名、分数、裁决和采取的修复操作。

## 签名更新

```bash
# 标准更新（哈希 + YARA 规则）
./tools/update-signatures.sh

# 完整更新，包含 VirusShare 2000 万+ MD5 哈希
./tools/update-signatures.sh --full

# 仅更新哈希数据库
./tools/update-signatures.sh --source hashes

# 仅更新 YARA 规则
./tools/update-signatures.sh --source yara
```
