import { eq } from 'drizzle-orm';
import { db, client } from '../src/db/client';
import { users } from '../src/db/schema';
import { hashPassword } from '../src/lib/auth';

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const name = process.env.ADMIN_NAME?.trim() || 'Admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('[seed-admin] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping');
    client.close();
    return;
  }

  const passwordHash = await hashPassword(password);
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    await db
      .update(users)
      .set({ passwordHash, role: 'admin', name, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.email, email));
    console.log(`[seed-admin] updated → ${email} (role=admin)`);
  } else {
    await db.insert(users).values({
      email,
      name,
      passwordHash,
      role: 'admin',
      emailVerifiedAt: new Date(),
      locale: 'pt'
    });
    console.log(`[seed-admin] created → ${email} (role=admin)`);
  }
  client.close();
}

main().catch((err) => {
  console.error('[seed-admin] failed', err);
  process.exit(1);
});
