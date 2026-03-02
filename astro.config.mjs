import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://openprx.dev',
  output: 'static',
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
