# Website Upgrade Plan — V2

## DO NOT change: global.css, brand colors, fonts, basic layout structure
## DO change: content density, visual richness, page sections, i18n JSONs

## Home Page Enhancements

### 1. Hero Section — Add Stats Bar
Below the hero description, add a horizontal stats bar with animated counters:
- "34" MCP Tools
- "14" AI Providers  
- "19" Channels
- "3" Protocols (HTTP, stdio, SSE)

Use a flex row of stat items, each with a large number (JetBrains Mono, brand color) and a small label below.

### 2. Product Cards — Richer Content
Each product card should now include:
- The existing icon, name, tagline, description
- A row of 3-4 small highlight tags (pill badges) showing key specs
- A tech stack line (small, dimmed)

Highlight tags per product:
- OpenPR: "Governance" "Kanban" "MCP Server" "SvelteKit"
- PRX: "14 Providers" "19 Channels" "Self-Evolution" "OAuth"
- prx-memory: "MCP Native" "Local-First" "Evolution" "Codex/Claude"

### 3. New Section: "Why OpenPRX"
After products, add a section with 3 columns:
- **Governed by Design**: "Every workflow includes trust scoring, review gates, and policy controls. Not bolted on — built in."
- **Rust-Native Performance**: "Sub-millisecond latency. Zero-copy where possible. Production reliability from day one."
- **AI-First Architecture**: "MCP protocol native. 34 tools. 14 providers. Agents aren't users of the system — they're first-class citizens."

### 4. New Section: "How It Fits Together"
A visual architecture overview showing how the 3 products connect:
```
┌─────────────┐     MCP      ┌─────────────┐
│   OpenPR    │◄────────────►│     PRX     │
│  (Manage)   │              │  (Operate)  │
└──────┬──────┘              └──────┬──────┘
       │                            │
       └──────────┬─────────────────┘
                  ▼
          ┌──────────────┐
          │  prx-memory  │
          │   (Remember) │
          └──────────────┘
```
Render this as styled SVG or HTML boxes with connecting lines. Use CSS grid.
Label each: "Manage → Operate → Remember"

### 5. New Section: "Get Involved"  
Simple CTA section before footer:
- GitHub org link
- "Star us on GitHub" button
- "Apache-2.0 Licensed" badge
- "Built with Rust 🦀" badge

## Product Detail Pages — Enhancements

### 1. Stats Bar at Top
Below the tagline, add a row of inline badges/stats:
- Language badge (Rust / Go)
- License badge (Apache-2.0)
- GitHub stars badge (already exists, keep it)

### 2. Features → Visual Grid
Replace the plain list with a 2-column grid of feature cards:
- Each card: emoji/icon + title + 1-2 line description
- OpenPR features (6 items):
  1. 📋 Issues & Boards — Full issue tracking with Kanban boards and sprint planning
  2. 🏛️ Governance Center — Proposals, voting, trust scores, decision records, veto & escalation  
  3. 🤖 AI Integration — Bot tokens, AI agents, AI tasks, AI review, webhook callbacks
  4. 🔌 MCP Server — 34 tools across HTTP, stdio, and SSE protocols
  5. 📎 File Attachments — Upload and attach files to issues and comments
  6. 🔐 Bot Token Auth — Secure API access for automated agents and integrations

- PRX features (6 items):
  1. 🧠 14 AI Providers — Anthropic, OpenAI, Google, Ollama, OpenRouter, Bedrock, GitHub Copilot, GLM, LiteLLM, vLLM, HuggingFace, and more
  2. 💬 19 Channels — Signal, WhatsApp, Telegram, Discord, Slack, IRC, and 13 more
  3. 🔄 Self-Evolution — Autonomous optimization system (~9,500 lines) with measurable acceptance criteria
  4. 🛡️ Governed Sub-Agents — Concurrency limits, depth controls, config inheritance, policy enforcement
  5. 🔑 OAuth Auto-Refresh — Automatic token refresh for Anthropic, GitHub Copilot, and compatible providers
  6. ⚡ Production Hardened — 3-phase security (DM/group policy, compaction, timeouts), rate limiting

- prx-memory features (6 items):
  1. 🔌 Dual Transport — stdio for local CLI integration, HTTP for networked access
  2. 🧰 Full Toolchain — store, recall, update, forget, export, import, migrate, reembed, compact
  3. 🏛️ Governance Controls — Structured format, tag normalization, ratio bounds, periodic maintenance
  4. 🧬 Evolution Support — memory_evolve with train+holdout acceptance and constraint gating
  5. 🎯 Hybrid Retrieval — Lexical + vector recall with optional reranking (Jina, Cohere, Pinecone)
  6. 🤝 Universal Compatibility — Works with Codex, Claude Code, OpenClaw, and any MCP client

### 3. Architecture Section (per product)
Add a simple architecture diagram after features.

OpenPR:
```
Browser → SvelteKit Frontend → Rust API (Axum) → PostgreSQL
                                    ↕
                              MCP Server (34 tools)
                              HTTP | stdio | SSE
```

PRX:
```
Channels (19)          Providers (14)
Signal, Telegram...    Anthropic, OpenAI...
        ↓                     ↓
    ┌─────────────────────────────┐
    │      PRX Core (Rust)        │
    │  Evolution · Governance     │
    │  Sub-agents · MCP Client    │
    └─────────────────────────────┘
```

prx-memory:
```
Coding Agents (Codex, Claude Code, OpenClaw...)
        ↓ MCP (stdio / HTTP)
┌───────────────────────────┐
│      prx-memory           │
│  Store · Recall · Evolve  │
│  Governance · Rerank      │
└───────────────────────────┘
        ↓
  Local JSON / Embeddings
```

Render these as styled HTML/CSS boxes, NOT as <pre> text.

### 4. Related Products
At bottom, show cards for the other 2 products: "Also from OpenPRX"

## i18n
Update ALL 4 language files (en.json, zh.json, ru.json, ka.json) with the new content.
For zh.json: use natural Chinese, not machine-translated.
For ka.json: use Georgian language.
For ru.json: use Russian language.

## Technical Notes
- Keep everything static Astro — no client JS frameworks
- Maintain existing CSS variable system
- Use the reveal animation class on new sections
- Architecture diagrams should be pure HTML/CSS (grid + borders), NOT images
- Stats numbers should use JetBrains Mono font
- All new sections need the `container-shell` + `panel` pattern
- Product page now needs more content, so consider a single-column flow instead of the 2-col grid

When completely finished, run: openclaw system event --text "Done: OpenPRX website V2 upgrade — richer content, architecture diagrams, stats, 4 languages" --mode now
