---
title: "Ship：Fenfa"
description: 多平台应用分发，支持上传 API、二维码和 iOS OTA 安装。
sidebar:
  order: 1
---

Fenfa 是一个使用 Go 和 Vue 3 构建的应用分发平台。它处理流水线的"最后一公里"：将 CI/CD 的构建产物提供给所有主要平台下载。

## 支持的平台

| 平台 | 格式 | 特性 |
|------|------|------|
| iOS | IPA | OTA 安装、UDID 注册、manifest plist 生成 |
| Android | APK | 直接下载、二维码 |
| macOS | DMG | 直接下载 |
| Windows | EXE、MSI | 直接下载 |
| Linux | AppImage、DEB、RPM | 直接下载 |

## 数据模型

Fenfa 使用三级层次结构组织分发：

```
Product（产品）
  └── Variant（变体，如 "iOS 生产版"、"Android 测试版"）
        └── Release（版本，带有产物的版本化构建）
```

- **Product** -- 一个逻辑应用（如 "MyApp"）
- **Variant** -- 产品中的特定构建配置或平台目标
- **Release** -- 上传到变体的单个版本化构建，包含二进制产物、版本字符串、构建号和更新日志

## 核心功能

### 上传 API

CI/CD 流水线通过带令牌认证的简单 `POST /upload` 端点上传构建。详见[上传 API](/docs/ship/upload-api/)。

### 下载页面

每个版本获得一个可分享的下载页面，包含：

- 适配平台的下载按钮
- 移动端扫描的二维码
- 版本信息和更新日志
- 自动平台检测（向访客推荐正确的变体）

### iOS OTA 安装

对于 iOS IPA 文件，Fenfa 生成所需的 `manifest.plist` 并通过 HTTPS 提供服务，实现无需 App Store 的直接空中安装。这需要：

- 有效的 HTTPS 端点（Fenfa 处理这一点）
- 设备 UDID 已注册到描述文件中

### iOS UDID 注册

Fenfa 提供 UDID 注册流程：用户在 iOS 设备上访问页面，安装一个轻量级配置描述文件，Fenfa 捕获设备 UDID。此 UDID 随后可添加到你的 Apple Developer 账号用于 ad-hoc 分发。

### S3/R2 存储

默认情况下，Fenfa 将产物存储在本地文件系统。对于生产部署，配置 S3 兼容后端（AWS S3、Cloudflare R2、MinIO）以实现持久、可扩展的存储。

## 快速开始

```bash
# 使用 Docker 运行
docker run -d \
  -p 8080:8080 \
  -v fenfa-data:/data \
  openprx/fenfa:latest

# 或从源码构建
git clone https://github.com/openprx/fenfa
cd fenfa && go build -o fenfa ./cmd/fenfa
./fenfa serve
```

启动后管理面板在 `http://localhost:8080/admin` 可用。第一个注册的用户成为管理员。

## 与流水线的集成

在 OpenPRX 流水线中，Fenfa 位于 Build 和 Protect 之间：

1. AI 代理完成代码变更并推送到仓库
2. CI/CD 构建产物（IPA、APK、DMG 等）
3. CI 通过[上传 API](/docs/ship/upload-api/) 上传产物到 Fenfa
4. Fenfa 生成下载页面并通知利益相关者
5. 用户下载并安装应用
6. PRX-WAF 和 PRX-SD 保护已部署的应用
