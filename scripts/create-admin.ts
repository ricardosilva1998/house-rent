import { createInterface } from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { db, client } from '../src/db/client';
import { users } from '../src/db/schema';
import { hashPassword } from '../src/lib/auth';

async function ask(rl: any, q: string, secret = false) {
  if (secret) {
    process.stdout.write(q);
    return new Promise<string>((resolve) => {
      const onData = (b: Buffer) => {
        const s = b.toString().replace(/[\r\n]/g, '');
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(s);
      };
      process.stdin.on('data', onData);
    });
  }
  const ans = await rl.question(q);
  return ans.trim();
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = (await ask(rl, 'Email: ')).toLowerCase();
    const name = await ask(rl, 'Nome: ');
    const password = await ask(rl, 'Palavra-passe (mín 8): ');
    if (password.length < 8) throw new Error('password too short');

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const passwordHash = await hashPassword(password);
    if (existing.length) {
      await db
        .update(users)
        .set({ passwordHash, role: 'admin', name, emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.email, email));
      console.log(`Updated existing user → admin: ${email}`);
    } else {
      await db.insert(users).values({
        email,
        name,
        passwordHash,
        role: 'admin',
        emailVerifiedAt: new Date(),
        locale: 'pt'
      });
      console.log(`Created admin user: ${email}`);
    }
  } finally {
    rl.close();
    client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
