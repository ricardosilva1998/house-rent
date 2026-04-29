import { z } from 'zod';

const schema = z.object({
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:4321'),
  DATABASE_URL: z.string().default('file:./data/dev.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  SESSION_SECRET: z.string().min(32).default('dev-only-session-secret-change-me-padded'),
  CRON_SECRET: z.string().min(8).default('dev-only-cron-secret'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Retiro dos Baeta <noreply@example.com>'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  AI_PRICING_MONTHLY_BUDGET_EUR: z.coerce.number().default(5),
  DEFAULT_LOCALE: z.enum(['pt', 'en', 'es']).default('pt'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] invalid environment', parsed.error.flatten());
  throw new Error('Invalid environment');
}

export const env = parsed.data;
export type Env = typeof env;
