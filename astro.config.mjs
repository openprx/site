import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://openprx.dev',
  output: 'static',
  integrations: [
    starlight({
      title: 'OpenPRX Docs',
      logo: {
        src: './public/brand-assets/logo-full.svg'
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/openprx' }
      ],
      editLink: {
        baseUrl: 'https://github.com/openprx/site/edit/main/'
      },
      sidebar: [
        { label: 'Getting Started', autogenerate: { directory: 'getting-started' } },
        { label: 'Plan: OpenPR', autogenerate: { directory: 'plan' } },
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
