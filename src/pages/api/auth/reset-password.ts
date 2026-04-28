import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { users } from '../../../db/schema';
import { consumeUserToken, hashPassword, destroyAllUserSessions } from '../../../lib/auth';

const Body = z.object({
  token: z.string().min(8),
  password: z.string().min(8).max(200)
});

export const POST: APIRoute = async ({ request }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });

  const userId = await consumeUserToken(parsed.data.token, 'reset_password');
  if (!userId) return Response.json({ ok: false, error: 'invalid_or_expired' }, { status: 400 });

  const passwordHash = await hashPassword(parsed.data.password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  await destroyAllUserSessions(userId);
  return Response.json({ ok: true });
};
