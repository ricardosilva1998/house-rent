/// <reference types="astro/client" />
import type { User } from './db/schema';
import type { Locale } from './i18n/use-translation';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      sessionId: string | null;
      locale: Locale;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL: string;
  readonly DEFAULT_LOCALE: 'pt' | 'en' | 'es';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
