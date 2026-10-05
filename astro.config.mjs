import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://openprx.dev',
  output: 'static',
  // Sylvode was formerly OpenPR. The edge redirects live in public/_redirects;
  // these generate fallback pages for hosts that do not read that file.
  redirects: {
    '/openpr': '/sylvode',
    '/zh/openpr': '/zh/sylvode',
    '/ka/openpr': '/ka/sylvode',
    '/ru/openpr': '/ru/sylvode'
  },
  integrations: [
    starlight({
      title: 'Docs',
      favicon: '/brand-assets/favicon.svg',
      routeMiddleware: './src/starlightRouteData.ts',
      logo: {
        dark: './src/assets/logo.svg',
        light: './src/assets/logo-light.svg'
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/openprx' }
      ],
      editLink: {
        baseUrl: 'https://github.com/openprx/site/edit/main/'
      },
      sidebar: [
        { label: 'Getting Started', autogenerate: { directory: 'getting-started' } },
        { label: 'Plan: Sylvode', autogenerate: { directory: 'plan' } },
        { label: 'Think: PRX', autogenerate: { directory: 'think' } },
        { label: 'Build: Agent Pipeline', autogenerate: { directory: 'build' } },
        { label: 'Ship: Fenfa', autogenerate: { directory: 'ship' } },
        { label: 'Protect: Security', autogenerate: { directory: 'protect' } }
      ]
    }),
    sitemap()
  ],
  vite: {
    plugins: [tailwindcss()]
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'ka', 'ru'],
    routing: {
      prefixDefaultLocale: false
    }
  }
});
