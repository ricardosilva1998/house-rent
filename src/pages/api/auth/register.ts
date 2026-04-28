import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { users } from '../../../db/schema';
import {
  hashPassword,
  createSession,
  setSessionCookie,
  createUserToken
} from '../../../lib/auth';
import { sendEmail, renderVerificationEmail } from '../../../lib/email';
import { env } from '../../../lib/env';

const Body = z.object({
  email: z.string().email().max(180),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional().or(z.literal('')),
  country: z.string().max(80).optional().or(z.literal('')),
  locale: z.enum(['pt', 'en', 'es']).optional()
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const data = Body.safeParse(await request.json().catch(() => ({})));
  if (!data.success) {
    return Response.json({ ok: false, error: 'invalid_input', issues: data.error.flatten() }, { status: 400 });
  }
  const email = data.data.email.toLowerCase();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return Response.json({ ok: false, error: 'email_exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(data.data.password);
  const inserted = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: data.data.name,
      phone: data.data.phone || null,
      country: data.data.country || null,
      locale: data.data.locale ?? 'pt'
    })
    .returning({ id: users.id, email: users.email, name: users.name, locale: users.locale });
  const user = inserted[0]!;

  const { token } = await createUserToken(user.id, 'verify_email');
  const verifyUrl = new URL(`/conta/verificar?token=${token}`, env.PUBLIC_SITE_URL).toString();
  const email_ = renderVerificationEmail({ name: user.name, verifyUrl, locale: user.locale });
  await sendEmail({ to: user.email, ...email_ });

  const session = await createSession(
    user.id,
    clientAddress ?? undefined,
    request.headers.get('user-agent') ?? undefined
  );
  const headers = new Headers({ 'content-type': 'application/json' });
  setSessionCookie(headers, session.token, session.expiresAt);
  return new Response(
    JSON.stringify({ ok: true, user: { id: user.id, email: user.email, name: user.name } }),
    { status: 201, headers }
  );
};
