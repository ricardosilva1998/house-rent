import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return Response.json({ ok: false, user: null }, { status: 200 });
  }
  const { id, email, name, role, locale, emailVerifiedAt } = locals.user;
  return Response.json({
    ok: true,
    user: { id, email, name, role, locale, emailVerified: !!emailVerifiedAt }
  });
};
