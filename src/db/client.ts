import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'file:./data/dev.db';
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

// Ensure parent directory exists for file:// (local SQLite) URLs.
// libsql:// URLs (Turso) are remote and skip this step.
if (url.startsWith('file:')) {
  const path = url.slice('file:'.length);
  const dir = dirname(path);
  if (dir && dir !== '.' && dir !== '/') {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // ignore (already exists, or unwritable — let libsql surface the real error)
    }
  }
}

export const client = createClient({ url, authToken });
export const db = drizzle(client, { schema });
export { schema };
export type DB = typeof db;
