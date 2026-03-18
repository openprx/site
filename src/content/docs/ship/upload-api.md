---
title: Upload API
description: Fenfa's HTTP API for uploading builds, managing products, and retrieving distribution metadata.
sidebar:
  order: 2
---

Fenfa exposes an HTTP API for uploading build artifacts from CI/CD pipelines and managing the distribution lifecycle.

## Authentication

All API requests require a token in the `X-Auth-Token` header:

```
X-Auth-Token: your-api-token
```

Tokens are created in the Fenfa admin dashboard under Settings.

## Upload Endpoint

### POST /upload

Upload a build artifact to a specific variant.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `variant_id` | string | Yes | Target variant ID |
| `app_file` | file | Yes | The binary artifact (IPA, APK, DMG, EXE, etc.) |
| `version` | string | Yes | Semantic version (e.g., `2.1.5`) |
| `build` | string | Yes | Build number (e.g., `142`) |
| `changelog` | string | No | Release notes (Markdown supported) |

Fenfa automatically computes a **SHA-256 hash** of the uploaded file for integrity verification.

**Example:**

```bash
curl -X POST https://fenfa.example.com/upload \
  -H "X-Auth-Token: your-api-token" \
  -F "variant_id=abc123" \
  -F "app_file=@build/MyApp.ipa" \
  -F "version=2.1.5" \
  -F "build=142" \
  -F "changelog=Fixed login crash on iOS 18"
```

**Response:**

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

The response includes platform-appropriate URLs:

- `download_url` -- Direct download link (all platforms)
- `install_url` -- iOS OTA installation link (IPA only)
- `qr_code_url` -- QR code image for the download page

## App Metadata Parsing

### POST /admin/api/parse-app

Upload a binary to extract its metadata without creating a release. Useful for inspecting build artifacts.

```bash
curl -X POST https://fenfa.example.com/admin/api/parse-app \
  -H "X-Auth-Token: your-api-token" \
  -F "file=@build/MyApp.apk"
```

Returns parsed metadata such as bundle ID, version, minimum OS version, permissions, and icon.

## Admin API

The admin API provides full management of the distribution platform.

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/api/products` | List all products |
| POST | `/admin/api/products` | Create a product |
| GET | `/admin/api/products/:id` | Get product details |
| PUT | `/admin/api/products/:id` | Update a product |
| DELETE | `/admin/api/products/:id` | Delete a product |

### Variants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/api/products/:id/variants` | List variants for a product |
| POST | `/admin/api/variants` | Create a variant |
| PUT | `/admin/api/variants/:id` | Update a variant |
| DELETE | `/admin/api/variants/:id` | Delete a variant |

### Releases

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/api/variants/:id/releases` | List releases for a variant |
| GET | `/admin/api/releases/:id` | Get release details |
| DELETE | `/admin/api/releases/:id` | Delete a release |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/api/settings` | Get platform settings |
| PUT | `/admin/api/settings` | Update platform settings |

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/api/devices` | List enrolled iOS devices (UDID) |
| DELETE | `/admin/api/devices/:id` | Remove a device |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/api/events` | Event log (uploads, downloads, errors) |

The events endpoint supports pagination and filtering by event type, date range, and variant.

## CSV Exports

The admin API supports CSV export for bulk data extraction:

```bash
# Export all releases for a variant
curl -H "X-Auth-Token: your-api-token" \
  "https://fenfa.example.com/admin/api/variants/abc123/releases?format=csv" \
  -o releases.csv

# Export device list
curl -H "X-Auth-Token: your-api-token" \
  "https://fenfa.example.com/admin/api/devices?format=csv" \
  -o devices.csv
```

## CI/CD Integration Example

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
