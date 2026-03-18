# openprx.dev

Official website for [OpenPRX](https://github.com/openprx) — AI-native development infrastructure.

**Live:** https://openprx.dev

## Tech Stack

- [Astro](https://astro.build/) 5 — Static site generator
- [Tailwind CSS](https://tailwindcss.com/) 4 — Utility-first CSS
- TypeScript

## Development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # Build to dist/
npm run preview   # Preview production build
```

## Structure

```
src/
├── components/    # Header, Footer, Icon, LanguageSwitcher
├── i18n/          # Translation files (en, zh, ka, ru)
├── layouts/       # MainLayout (HTML shell, SEO, theme)
├── pages/         # Route pages (product pages per locale)
├── styles/        # Global CSS, Tailwind config
└── templates/     # HomePage, ProductPage (shared templates)
```

## i18n

4 languages: English (default, no prefix), 中文 (`/zh/`), ქართული (`/ka/`), Русский (`/ru/`).

Translations live in `src/i18n/*.json`. The `Dictionary` type is derived from `en.json`.

## Deployment

Static output deployed to Cloudflare Pages. Push to `main` triggers auto-deploy.

## License

[Apache-2.0](LICENSE)
