---
title: PRX-WAF
description: "基于 Cloudflare Pingora 构建的 17 阶段 Web 应用防火墙，支持多格式规则和实时通知。"
sidebar:
  order: 2
---

PRX-WAF 是一个 Web 应用防火墙，构建为基于 Cloudflare Pingora 代理框架的 7-crate Rust 工作区。它通过 17 阶段检测流水线检查 HTTP 流量，支持 YAML、ModSecurity 和 JSON 规则格式。

## 架构

PRX-WAF 组织为包含七个 crate 的 Rust 工作区：

| Crate | 角色 |
|-------|------|
| `prx-waf-core` | Pingora 集成、请求/响应生命周期、阶段编排 |
| `prx-waf-rules` | 规则解析（YAML、ModSecurity、JSON）、规则引擎 |
| `prx-waf-detection` | 所有 17 个阶段的检测逻辑 |
| `prx-waf-admin` | Vue 3 管理面板和管理 API |
| `prx-waf-notification` | 告警投递（Webhook、Telegram、邮件） |
| `prx-waf-cluster` | 基于 QUIC 的集群同步 |
| `prx-waf-cli` | 命令行界面 |

## 17 阶段检测流水线

每个 HTTP 请求按顺序通过这些阶段。任何阶段的匹配都可以使用配置的操作终止处理。

| 阶段 | 名称 | 说明 |
|------|------|------|
| 1 | IP 白名单 | 允许来自受信任 IP 的请求（跳过所有后续阶段） |
| 2 | IP 黑名单 | 阻止来自已知恶意 IP 的请求 |
| 3 | URL 白名单 | 允许对受信任 URL 路径的请求 |
| 4 | URL 黑名单 | 阻止对禁止 URL 路径的请求 |
| 5 | CC/DDoS | 速率限制和连接洪泛检测 |
| 6 | 扫描器检测 | 识别自动化漏洞扫描器（Nikto、sqlmap 等） |
| 7 | Bot 检测 | 区分机器人和人类（指纹识别、验证挑战） |
| 8 | SQL 注入 | 检测参数、头和请求体中的 SQLi 载荷 |
| 9 | XSS | 检测跨站脚本攻击载荷 |
| 10 | RCE | 检测远程代码执行尝试（命令注入、SSRF） |
| 11 | 目录遍历 | 检测路径遍历尝试（`../`、编码变体） |
| 12 | 自定义规则 (Rhai) | 使用 Rhai 脚本语言编写的用户自定义检测逻辑 |
| 13 | OWASP CRS | OWASP 核心规则集兼容层 |
| 14 | 敏感数据 | 检测响应中的敏感数据（信用卡号、SSN、API 密钥） |
| 15 | 防盗链 | 防止未授权嵌入你的资源 |
| 16 | CrowdSec | 与 CrowdSec 社区黑名单集成 |
| 17 | GeoIP | 按国家/地区阻止或允许流量 |

## 规则格式

PRX-WAF 支持三种规则格式，允许团队使用偏好的语法或导入现有规则集：

### YAML 规则

```yaml
- id: sql-injection-union
  phase: 8
  description: "Detect UNION-based SQL injection"
  match:
    field: args
    pattern: "(?i)union\\s+(all\\s+)?select"
  action: block
  severity: critical
```

### ModSecurity 规则

```
SecRule ARGS "@rx (?i)union\s+(all\s+)?select" \
  "id:1001,phase:2,deny,status:403,msg:'SQL Injection'"
```

### JSON 规则

```json
{
  "id": "xss-script-tag",
  "phase": 9,
  "match": {"field": "args", "pattern": "<script[^>]*>"},
  "action": "block"
}
```

PRX-WAF 附带 **50+ 规则文件**，覆盖所有检测阶段的常见攻击模式。

## 响应操作

当规则匹配时，PRX-WAF 可以执行以下操作之一：

| 操作 | 说明 |
|------|------|
| `block` | 返回 403 响应并终止请求 |
| `allow` | 明确允许请求（跳过剩余阶段） |
| `log` | 记录匹配但允许请求继续 |
| `redirect` | 将客户端重定向到指定 URL |

操作按规则配置，可被全局策略覆盖。

## 通知系统

PRX-WAF 在检测到威胁时推送实时告警：

| 渠道 | 配置 |
|------|------|
| Webhook | 向任意端点发送 JSON 载荷的 HTTP POST |
| Telegram | Bot API，带聊天 ID |
| Email | SMTP，可配置发件人/收件人 |

通知包含匹配的规则、请求详情（IP、URL、头）、严重程度和采取的操作。

## 实时流

PRX-WAF 支持 **WebSocket 实时流**用于实时监控：

- 带检测结果的实时请求日志
- 攻击频率指标
- 被阻止的顶级 IP 和攻击类型

管理面板连接到这些流以获得实时安全概览。

## QUIC 集群

对于多节点部署，PRX-WAF 节点通过 **QUIC** 同步状态：

- 共享 IP 黑名单和速率限制计数器
- 规则更新传播到所有节点
- 一致的 GeoIP 和 CrowdSec 数据

## 管理面板

Vue 3 管理面板提供：

- 实时流量和威胁可视化
- 规则管理（创建、编辑、启用/禁用）
- IP 白名单/黑名单管理
- 检测阶段配置
- 通知渠道设置
- 集群节点状态

## 运行

```bash
# 构建所有 crate
cargo build --release

# 使用配置运行
./target/release/prx-waf --config /etc/prx-waf/config.yaml

# CLI：用示例请求测试规则
./target/release/prx-waf-cli test-rule --rule rules/sqli.yaml --request sample.http
```
