---
title: 上传 API
description: Fenfa 的 HTTP API，用于上传构建、管理产品和检索分发元数据。
sidebar:
  order: 2
---

Fenfa 暴露 HTTP API 用于从 CI/CD 流水线上传构建产物和管理分发生命周期。

## 认证

所有 API 请求需要在 `X-Auth-Token` 头中包含令牌：

```
X-Auth-Token: your-api-token
```

令牌在 Fenfa 管理面板的设置中创建。

## 上传端点

### POST /upload

上传构建产物到特定变体。

**Content-Type:** `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `variant_id` | string | 是 | 目标变体 ID |
| `app_file` | file | 是 | 二进制产物（IPA、APK、DMG、EXE 等） |
| `version` | string | 是 | 语义版本号（如 `2.1.5`） |
| `build` | string | 是 | 构建号（如 `142`） |
| `changelog` | string | 否 | 发布说明（支持 Markdown） |

Fenfa 自动计算上传文件的 **SHA-256 哈希**用于完整性验证。

**示例：**

```bash
curl -X POST https://fenfa.example.com/upload \
  -H "X-Auth-Token: your-api-token" \
  -F "variant_id=abc123" \
  -F "app_file=@build/MyApp.ipa" \
  -F "version=2.1.5" \
  -F "build=142" \
  -F "changelog=Fixed login crash on iOS 18"
```

**响应：**

```json
{
  "success": true,
  "release": {
    "id": "rel_abc123",
    "version": "2.1.5",
    "build": "142",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb924...",
    "download_url": "https://fenfa.example.com/d/rel_abc123",
    "install_url": "itms-services://?action=download-manifest&url=...",
    "qr_code_url": "https://fenfa.example.com/qr/rel_abc123"
  }
}
```

响应包含适配平台的 URL：

- `download_url` -- 直接下载链接（所有平台）
- `install_url` -- iOS OTA 安装链接（仅 IPA）
- `qr_code_url` -- 下载页面的二维码图片

## 应用元数据解析

### POST /admin/api/parse-app

上传二进制文件以提取其元数据，而不创建版本。适用于检查构建产物。

```bash
curl -X POST https://fenfa.example.com/admin/api/parse-app \
  -H "X-Auth-Token: your-api-token" \
  -F "file=@build/MyApp.apk"
```

返回解析的元数据，如包 ID、版本、最低 OS 版本、权限和图标。

## 管理 API

管理 API 提供分发平台的完整管理功能。

### 产品

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/admin/api/products` | 列出所有产品 |
| POST | `/admin/api/products` | 创建产品 |
| GET | `/admin/api/products/:id` | 获取产品详情 |
| PUT | `/admin/api/products/:id` | 更新产品 |
| DELETE | `/admin/api/products/:id` | 删除产品 |

### 变体

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/admin/api/products/:id/variants` | 列出产品的变体 |
| POST | `/admin/api/variants` | 创建变体 |
| PUT | `/admin/api/variants/:id` | 更新变体 |
| DELETE | `/admin/api/variants/:id` | 删除变体 |

### 版本

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/admin/api/variants/:id/releases` | 列出变体的版本 |
| GET | `/admin/api/releases/:id` | 获取版本详情 |
| DELETE | `/admin/api/releases/:id` | 删除版本 |

### 设置

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/admin/api/settings` | 获取平台设置 |
| PUT | `/admin/api/settings` | 更新平台设置 |

### 设备

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/admin/api/devices` | 列出已注册的 iOS 设备（UDID） |
| DELETE | `/admin/api/devices/:id` | 移除设备 |

### 事件

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/admin/api/events` | 事件日志（上传、下载、错误） |

事件端点支持按事件类型、日期范围和变体的分页和过滤。

## CSV 导出

管理 API 支持 CSV 导出用于批量数据提取：

```bash
# 导出变体的所有版本
curl -H "X-Auth-Token: your-api-token" \
  "https://fenfa.example.com/admin/api/variants/abc123/releases?format=csv" \
  -o releases.csv

# 导出设备列表
curl -H "X-Auth-Token: your-api-token" \
  "https://fenfa.example.com/admin/api/devices?format=csv" \
  -o devices.csv
```

## CI/CD 集成示例

### GitHub Actions

```yaml
- name: Upload to Fenfa
  run: |
    curl -X POST ${{ secrets.FENFA_URL }}/upload \
      -H "X-Auth-Token: ${{ secrets.FENFA_TOKEN }}" \
      -F "variant_id=${{ vars.FENFA_VARIANT_ID }}" \
      -F "app_file=@build/output/MyApp.apk" \
      -F "version=${{ github.ref_name }}" \
      -F "build=${{ github.run_number }}" \
      -F "changelog=$(git log --oneline -5)"
```
