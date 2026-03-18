---
title: "Ship: Fenfa"
description: Multi-platform app distribution with upload API, QR codes, and iOS OTA support.
sidebar:
  order: 1
---

Fenfa is an app distribution platform built with Go and Vue 3. It handles the "last mile" of the pipeline: taking build artifacts from CI/CD and making them available for download across all major platforms.

## Supported Platforms

| Platform | Formats | Features |
|----------|---------|----------|
| iOS | IPA | OTA installation, UDID enrollment, manifest plist generation |
| Android | APK | Direct download, QR code |
| macOS | DMG | Direct download |
| Windows | EXE, MSI | Direct download |
| Linux | AppImage, DEB, RPM | Direct download |

## Data Model

Fenfa organizes distributions with a three-level hierarchy:

```
Product
  └── Variant (e.g., "iOS Production", "Android Beta")
        └── Release (versioned build with artifact)
```

- **Product** -- A logical application (e.g., "MyApp")
- **Variant** -- A specific build configuration or platform target within a product
- **Release** -- A single versioned build uploaded to a variant, containing the binary artifact, version string, build number, and changelog

## Key Features

### Upload API

CI/CD pipelines upload builds via a simple `POST /upload` endpoint with token authentication. See [Upload API](/docs/ship/upload-api/) for full details.

### Download Pages

Each release gets a shareable download page with:

- Platform-appropriate download buttons
- QR code for mobile scanning
- Version info and changelog
- Automatic platform detection (suggests the right variant to the visitor)

### iOS OTA Installation

For iOS IPA files, Fenfa generates the required `manifest.plist` and serves it over HTTPS, enabling direct over-the-air installation without the App Store. This requires:

- A valid HTTPS endpoint (Fenfa handles this)
- The device UDID to be enrolled in the provisioning profile

### iOS UDID Enrollment

Fenfa provides a UDID enrollment flow: users visit a page on their iOS device, install a lightweight configuration profile, and Fenfa captures the device UDID. This UDID can then be added to your Apple Developer account for ad-hoc distribution.

### S3/R2 Storage

By default, Fenfa stores artifacts on the local filesystem. For production deployments, configure an S3-compatible backend (AWS S3, Cloudflare R2, MinIO) for durable, scalable storage.

## Quick Start

```bash
# Run with Docker
docker run -d \
  -p 8080:8080 \
  -v fenfa-data:/data \
  openprx/fenfa:latest

# Or build from source
git clone https://github.com/openprx/fenfa
cd fenfa && go build -o fenfa ./cmd/fenfa
./fenfa serve
```

The admin dashboard is available at `http://localhost:8080/admin` after startup. The first registered user becomes the administrator.

## Integration with the Pipeline

In the OpenPRX pipeline, Fenfa sits between Build and Protect:

1. An AI agent completes code changes and pushes to the repository
2. CI/CD builds the artifact (IPA, APK, DMG, etc.)
3. CI uploads the artifact to Fenfa via the [Upload API](/docs/ship/upload-api/)
4. Fenfa generates download pages and notifies stakeholders
5. Users download and install the application
6. PRX-WAF and PRX-SD protect the deployed application
