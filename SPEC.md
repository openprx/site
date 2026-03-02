# OpenPRX Official Website — openprx.dev

## Overview
Build the official website for the OpenPRX open-source organization using Astro.

## Brand
- Logo SVGs are in `brand-assets/` — use them directly
- Primary color: #6366f1 (dark), #4338ca (light)
- Fonts: JetBrains Mono (code/icons), Inter (body/headings)
- Style: Dark-first, developer-focused, minimal, similar to astral.sh or linear.app
- Logo: Hex (hexagon with vertex dots + PRX text)

## i18n — 4 Languages
- English (default, `/en/` or `/`)
- Chinese (`/zh/`)
- Georgian (`/ka/`)
- Russian (`/ru/`)

Use Astro's built-in i18n routing. Create translation JSON files for each locale.

## Structure

### Pages
1. **Home `/`** — Hero section with logo + tagline + product cards grid
2. **OpenPR `/openpr`** — Project management platform detail page
3. **PRX `/prx`** — AI assistant framework detail page  
4. **prx-memory `/prx-memory`** — MCP memory component detail page

### Home Page Sections
- **Hero**: Large logo + "AI-native development infrastructure" + "Open source. Built with Rust." + GitHub link + Get Started CTA
- **Products Grid**: 4 cards (OpenPR, PRX, prx-memory, wacli) with icon, description, GitHub link
- **Features**: Key selling points (Rust performance, MCP protocol, Self-evolution, Governance)
- **Footer**: GitHub org link, license info, language switcher

### Product Pages
Each product page should have:
- Product name + one-line description
- Key features list
- Quick start code block
- GitHub repo link + star button
- Back to home link

## Product Info

### OpenPR
- Tagline: "Open-source project management with built-in governance"
- Tech: Rust (Axum + SeaORM), SvelteKit, PostgreSQL
- Features: Issues/Kanban/Sprints, Governance center (proposals/voting/trust scores), AI integration (bot tokens, AI tasks), MCP server (34 tools, 3 protocols)
- Repo: github.com/openprx/openpr

### PRX (OpenPRX)
- Tagline: "Self-evolving AI assistant framework"
- Tech: Rust
- Features: 14 AI providers, 19 messaging channels, Self-evolution system (~9500 lines), OAuth auto-refresh, Governed sub-agents
- Repo: github.com/openprx/prx

### prx-memory
- Tagline: "Local-first MCP memory for coding agents"
- Tech: Rust
- Features: stdio + HTTP transport, Full memory toolchain (store/recall/update/forget), Governance controls, Evolution support, Works with Codex/Claude Code/OpenClaw
- Repo: github.com/openprx/prx-memory

### wacli
- Tagline: "WhatsApp CLI with JSON-RPC daemon"
- Tech: Go (whatsmeow)
- Features: JSON-RPC daemon mode, Send/receive/subscribe, Chat management
- Repo: github.com/openprx/wacli

## Tech Requirements
- Astro 5.x with static output
- Tailwind CSS 4
- Dark mode default, light mode toggle
- Responsive (mobile-first)
- Language switcher in header/footer
- SEO meta tags per page
- Smooth scroll animations (CSS only, no heavy JS)
- Deploy-ready for Cloudflare Pages

## DO NOT
- Use any heavy JS frameworks (React/Vue/Svelte components) — keep it static
- Use placeholder images — SVG illustrations or code blocks only
- Make it look generic/template-y — it should feel crafted

When completely finished, run: openclaw system event --text "Done: OpenPRX official website built with Astro, 4 languages, 4 product pages" --mode now
