import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { users } from '../../../db/schema';
import { consumeUserToken } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) return Response.json({ ok: false, error: 'invalid_token' }, { status: 400 });

  const userId = await consumeUserToken(token, 'verify_email');
  if (!userId) return Response.json({ ok: false, error: 'invalid_or_expired' }, { status: 400 });

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  return Response.json({ ok: true });
};
