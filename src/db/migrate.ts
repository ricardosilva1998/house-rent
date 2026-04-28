import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, client } from './client';

async function main() {
  console.log('[migrate] running migrations from src/db/migrations …');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('[migrate] done');
  client.close();
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
