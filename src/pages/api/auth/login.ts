import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  findUserByEmail,
  verifyPassword,
  createSession,
  setSessionCookie
} from '../../../lib/auth';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }
  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  const session = await createSession(
    user.id,
    clientAddress ?? undefined,
    request.headers.get('user-agent') ?? undefined
  );
  const headers = new Headers({ 'content-type': 'application/json' });
  setSessionCookie(headers, session.token, session.expiresAt);
  return new Response(
    JSON.stringify({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    }),
    { status: 200, headers }
  );
};
