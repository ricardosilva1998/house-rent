import type { APIRoute } from 'astro';
import { z } from 'zod';
import { findUserByEmail, createUserToken } from '../../../lib/auth';
import { sendEmail } from '../../../lib/email';
import { env } from '../../../lib/env';

const Body = z.object({ email: z.string().email() });

export const POST: APIRoute = async ({ request }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: true }); // do not leak

  const user = await findUserByEmail(parsed.data.email);
  if (user) {
    const { token } = await createUserToken(user.id, 'reset_password');
    const url = new URL(`/conta/recuperar?token=${token}`, env.PUBLIC_SITE_URL).toString();
    await sendEmail({
      to: user.email,
      subject: 'Recuperar palavra-passe — Retiro dos Baeta',
      html: `<p>Para redefinir a sua palavra-passe, clique <a href="${url}">aqui</a>. Este link é válido por 24 horas.</p>`
    });
  }
  return Response.json({ ok: true });
};
