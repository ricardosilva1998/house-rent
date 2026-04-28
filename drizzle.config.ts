import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/dev.db',
    authToken: process.env.DATABASE_AUTH_TOKEN
  },
  strict: true,
  verbose: true
});
