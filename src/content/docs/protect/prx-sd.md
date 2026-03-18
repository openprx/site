---
title: PRX-SD
description: "An 11-crate Rust antivirus engine with hash matching, YARA rules, heuristic analysis, ML inference, and real-time file monitoring."
sidebar:
  order: 3
---

PRX-SD is an open-source antivirus engine built as an 11-crate Rust workspace. It combines traditional signature-based detection with heuristic analysis and machine learning to identify malware on endpoints across Linux, macOS, and Windows.

## Architecture

| Crate | Role |
|-------|------|
| `prx-sd-core` | Shared types, configuration, scoring, error handling |
| `prx-sd-scanner` | Orchestrates the 5-stage detection pipeline |
| `prx-sd-signatures` | Hash database (LMDB) and signature management |
| `prx-sd-yara` | YARA rule compilation and matching |
| `prx-sd-heuristics` | Entropy analysis, packer detection, suspicious API/behavior patterns |
| `prx-sd-ml` | ML inference via ONNX Runtime / tract |
| `prx-sd-quarantine` | AES-256-GCM encrypted vault for isolated threats |
| `prx-sd-sandbox` | Process sandboxing (ptrace, seccomp, namespaces, Landlock) |
| `prx-sd-monitor` | Real-time filesystem monitoring |
| `prx-sd-cli` | Command-line interface (`sd`) |
| `prx-sd-gui` | Desktop GUI (Tauri + Vue 3) |

## 5-Stage Detection Pipeline

Every scanned file passes through these stages. Detection at any stage can short-circuit with a final verdict.

```
File input
  │
  ▼
1. Hash Matching ──match──▶ MALICIOUS (instant)
  │ no match
  ▼
2. File-Type Detection (magic bytes)
  │
  ▼
3. Format Parsing (PE / ELF / MachO / PDF / Office)
  │
  ▼
4. Parallel Analysis
  │
  ├── YARA Rule Scan ──match──▶ MALICIOUS
  ├── Heuristic Engine ──score──▶ scored
  └── ML Inference (ONNX/tract) ──score──▶ scored
  │
  ▼
5. VirusTotal Cloud Lookup (optional)
  │
  ▼
Aggregate → Final Verdict
```

### Stage 1: Hash Matching

The fastest detection method. File SHA-256 (and optionally MD5) is looked up in an LMDB database with O(1) access time.

**Signature sources:**

| Source | Type | Content |
|--------|------|---------|
| abuse.ch MalwareBazaar | SHA-256 | Malware samples from the last 48 hours |
| abuse.ch URLhaus | SHA-256 | File hashes from malicious URLs |
| abuse.ch Feodo Tracker | SHA-256 | Banking trojans (Emotet, Dridex, TrickBot) |
| VirusShare | MD5 | 20M+ malware hashes (full mode) |
| ClamAV | Multiple | .cvd/.ndb signatures (parser included) |
| Built-in blocklist | SHA-256 | EICAR, WannaCry, NotPetya, Emotet, and others |

### Stage 2: File-Type Detection

Magic byte identification determines the true file type regardless of extension: PE, ELF, MachO, PDF, ZIP, Office (OLE/OOXML).

### Stage 3: Format Parsing

Deep parsing of recognized formats extracts structural metadata used by the heuristic engine:

| Format | Extracted Data |
|--------|---------------|
| PE (Windows) | Sections, imports, exports, resources, timestamps, digital signatures |
| ELF (Linux) | Sections, symbols, dynamic linking, interpreter path |
| MachO (macOS) | Load commands, dylib dependencies, entitlements, code signatures |
| PDF | JavaScript, embedded files, launch actions, URI actions |
| Office | Macros (VBA), OLE streams, DDE links, embedded objects |

### Stage 4: Parallel Analysis

Three analysis engines run concurrently on the parsed file:

**YARA Rules** -- Pattern matching against 38,800+ rules from multiple sources (built-in, Yara-Rules, Neo23x0/signature-base, ReversingLabs, ESET, InQuest).

**Heuristic Engine** -- Scores files based on structural anomalies:

| Check | Applies to | What it detects |
|-------|-----------|-----------------|
| Section entropy | PE, ELF, MachO | Packed or encrypted sections (high entropy) |
| Packer detection | PE | Known packers (UPX, Themida, VMProtect) |
| Suspicious API imports | PE | Process injection, keylogging, crypto, anti-debug |
| LD_PRELOAD hooks | ELF | Shared library injection |
| cron/systemd persistence | ELF | Persistence mechanisms |
| SSH backdoor indicators | ELF | Unauthorized SSH key injection |
| dylib injection | MachO | Dynamic library hijacking |
| LaunchAgent/Daemon | MachO | macOS persistence mechanisms |
| Keychain access | MachO | Credential theft indicators |
| Timestamp anomalies | PE | Forged compilation timestamps |

**ML Inference** -- Machine learning classification via ONNX Runtime or tract. Models score files based on features extracted during parsing.

### Stage 5: VirusTotal Cloud Lookup (Optional)

If enabled, the file hash is checked against VirusTotal's database for additional vendor verdicts.

## Scoring

All analysis results are aggregated into a single numeric score:

| Score Range | Verdict | Meaning |
|-------------|---------|---------|
| 0--29 | Clean | No threats detected |
| 30--69 | Suspicious | Some indicators present, manual review recommended |
| 70--100 | Malicious | High-confidence threat, automatic action recommended |

The final verdict uses the highest severity from any detection stage.

## Real-Time Monitoring

PRX-SD monitors filesystem changes in real time using platform-native APIs:

| Platform | API |
|----------|-----|
| Linux | fanotify |
| macOS | FSEvents |
| Windows | ReadDirectoryChangesW |

When a new or modified file is detected, it is automatically scanned through the full pipeline.

### Ransomware Detection

The monitor includes specialized ransomware detection: rapid file rename/encrypt patterns, known ransomware extensions, and high-entropy bulk writes trigger immediate alerts.

## Quarantine

Detected threats are moved to an **AES-256-GCM encrypted vault**:

- Files are encrypted before storage to prevent accidental execution
- Original path and metadata are preserved for restoration
- Quarantined files can be listed, inspected, or restored via CLI

```bash
# List quarantined files
sd quarantine list

# Restore a quarantined file
sd quarantine restore <ID>

# Permanently delete quarantined file
sd quarantine delete <ID>
```

## Remediation

Beyond quarantine, PRX-SD can take active remediation steps:

| Action | Description |
|--------|-------------|
| Kill process | Terminate the process that created or is using the malicious file |
| Clean persistence | Remove cron jobs, systemd units, LaunchAgents, or registry entries associated with the threat |
| Network isolation | Block outbound connections from the compromised process or host |

## Sandbox

PRX-SD can execute suspicious files in a restricted sandbox for behavioral analysis:

| Mechanism | Platform | Purpose |
|-----------|----------|---------|
| ptrace | Linux | System call tracing |
| seccomp | Linux | System call filtering |
| namespaces | Linux | Filesystem and network isolation |
| Landlock | Linux 5.13+ | Filesystem access restrictions |

### Behavior Rules

The sandbox monitors for 10 categories of suspicious behavior:

1. File encryption (bulk write with high entropy)
2. Process injection (ptrace attach, `/proc/*/mem` writes)
3. Credential access (reading `/etc/shadow`, keychain, browser storage)
4. Network beaconing (periodic outbound connections to unknown hosts)
5. Persistence installation (cron, systemd, LaunchAgent, registry)
6. Privilege escalation (setuid, sudo, capability manipulation)
7. Anti-analysis (debugger detection, VM detection, sleep evasion)
8. Data exfiltration (large outbound transfers, DNS tunneling)
9. Lateral movement (SSH, SMB, WMI activity)
10. Defense evasion (log deletion, timestomping, binary packing)

## CLI Commands

```bash
# Scan a single file
sd scan /path/to/file

# Scan a directory recursively
sd scan /home --recursive

# Scan with auto-quarantine
sd scan /tmp --auto-quarantine

# JSON output for programmatic use
sd scan /path --json

# Real-time directory monitoring
sd monitor /home /tmp

# Update signature databases
sd update

# Import custom hashes
sd import my_hashes.txt

# Show database and engine info
sd info
```

## Webhook Alerts

PRX-SD sends detection alerts via webhook to external services:

| Format | Endpoint |
|--------|----------|
| Slack | Incoming webhook URL |
| Discord | Webhook URL |
| Generic JSON | Any HTTP endpoint |

Alert payloads include: file path, SHA-256 hash, matched rules/signatures, score, verdict, and remediation action taken.

## Signature Updates

```bash
# Standard update (hashes + YARA rules)
./tools/update-signatures.sh

# Full update including VirusShare 20M+ MD5 hashes
./tools/update-signatures.sh --full

# Update only hash databases
./tools/update-signatures.sh --source hashes

# Update only YARA rules
./tools/update-signatures.sh --source yara
```
