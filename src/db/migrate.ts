import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, client } from './client';

async function main() {
  // For local/file URLs, ensure the parent directory exists (Railway containers
  // do not start with a data/ folder). For libsql:// (Turso) URLs, this is a no-op.
  const url = process.env.DATABASE_URL ?? 'file:./data/dev.db';
  if (url.startsWith('file:')) {
    const path = url.slice('file:'.length);
    const dir = dirname(path);
    if (dir && dir !== '.') {
      await mkdir(dir, { recursive: true }).catch(() => {});
    }
  }

  console.log('[migrate] running migrations from src/db/migrations …');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('[migrate] done');
  client.close();
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
