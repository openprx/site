import en from './en.json';
import zh from './zh.json';
import ka from './ka.json';
import ru from './ru.json';

export const locales = ['en', 'zh', 'ka', 'ru'] as const;

export type Locale = (typeof locales)[number];
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  zh,
  ka,
  ru
};

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ka: 'ქართული',
  ru: 'Русский'
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function localePath(locale: Locale, path: string): string {
  const normalized = path === '' ? '/' : path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') {
    return normalized;
  }
  return normalized === '/' ? `/${locale}/` : `/${locale}${normalized}`;
}
