import type { APIRoute } from 'astro';
import { destroySession, readSessionCookie, clearSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const token = readSessionCookie(request.headers);
  await destroySession(token);
  const headers = new Headers({ 'content-type': 'application/json' });
  clearSessionCookie(headers);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
