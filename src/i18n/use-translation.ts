import pt from './pt.json';
import en from './en.json';
import es from './es.json';

export const locales = ['pt', 'en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pt';

const dictionaries: Record<Locale, unknown> = { pt, en, es };

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

function getNested(obj: unknown, path: string[]): string | undefined {
  let cur: any = obj;
  for (const segment of path) {
    if (cur && typeof cur === 'object' && segment in cur) {
      cur = cur[segment];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function format(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  // Tiny ICU subset: {var, plural, one {text with #} other {text with #}}.
  // # is replaced with the value of var.
  let out = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\}/g,
    (_, key, oneText, otherText) => {
      const v = params[key];
      const n = typeof v === 'number' ? v : Number(v);
      const text = n === 1 ? oneText : otherText;
      return text.replace(/#/g, String(n));
    }
  );
  out = out.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
  return out;
}

export function createT(locale: Locale) {
  const dict = dictionaries[locale];
  const fallback = dictionaries[defaultLocale];
  return function t(key: string, params?: Record<string, string | number>): string {
    const path = key.split('.');
    const value = getNested(dict, path) ?? getNested(fallback, path) ?? key;
    return format(value, params);
  };
}

export function localeFromUrl(url: URL): Locale {
  const segments = url.pathname.split('/').filter(Boolean);
  const first = segments[0];
  return isLocale(first) ? first : defaultLocale;
}

export function pathInLocale(path: string, locale: Locale): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return `/${locale}${clean === '/' ? '' : clean}`;
}
