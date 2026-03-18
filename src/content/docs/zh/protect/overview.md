---
title: "Protect：安全防护"
description: 两个互补的安全产品，用于网络防御和端点保护。
sidebar:
  order: 1
---

Protect 阶段通过两个互补的产品防护已部署的应用和基础设施：

| 产品 | 领域 | 保护对象 |
|------|------|----------|
| [PRX-WAF](/docs/protect/prx-waf/) | 网络 | HTTP/HTTPS 流量——在攻击到达你的应用之前拦截 |
| [PRX-SD](/docs/protect/prx-sd/) | 端点 | 文件和进程——检测并清除主机上的恶意软件 |

## 纵深防御

PRX-WAF 和 PRX-SD 覆盖安全栈的不同层：

```
互联网流量
    │
    ▼
┌─────────────────────────────┐
│  PRX-WAF（网络层）            │
│  17 阶段检测流水线            │
│  SQLi · XSS · RCE · DDoS    │
│  Bot 检测 · GeoIP            │
└──────────────┬──────────────┘
               │ 干净流量
               ▼
┌─────────────────────────────┐
│  应用服务器                    │
│  文件写入磁盘                  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  PRX-SD（端点层）             │
│  哈希匹配 · YARA 规则         │
│  启发式分析 · 机器学习         │
│  实时文件监控                  │
└─────────────────────────────┘
```

## 自动响应

两个产品都支持自动响应操作：

| 产品 | 操作 |
|------|------|
| PRX-WAF | 拦截请求、重定向、仅记录、速率限制、CrowdSec 举报 |
| PRX-SD | 隔离文件、终止进程、清理持久化机制、网络隔离 |

## 通知系统

两个产品通过多种渠道推送告警：

| 渠道 | PRX-WAF | PRX-SD |
|------|---------|--------|
| Webhook (JSON) | 是 | 是 |
| Slack | 是 | 是 |
| Discord | 是 | 是 |
| Telegram | 是 | -- |
| Email | 是 | -- |

## 愿景：安全反馈闭环

在完整的 OpenPRX 流水线中，安全事件反馈回开发周期：

1. **PRX-WAF** 检测到针对你 API 的新攻击模式
2. 安全事件作为 Issue 创建到 **OpenPR** 中
3. AI 代理通过 **openpr-webhook** 被派发分析漏洞
4. 代理修补代码并推送修复
5. **Fenfa** 分发更新后的构建
6. **PRX-WAF** 和 **PRX-SD** 的规则更新以覆盖新模式

这实现了从检测到修复的闭环，无需人工干预。

## 技术栈

两个产品都使用 Rust 构建，以确保性能和内存安全：

| 产品 | 架构 | Crate |
|------|------|-------|
| PRX-WAF | 基于 Cloudflare Pingora 的 7-crate 工作区 | Core、rules、detection、admin、notification、cluster、CLI |
| PRX-SD | 11-crate 工作区 | Core、scanner、signatures、YARA、heuristics、ML、quarantine、sandbox、monitor、CLI、GUI (Tauri) |
