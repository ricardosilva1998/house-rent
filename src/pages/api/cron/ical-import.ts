import type { APIRoute } from 'astro';
import { importAllActiveFeeds } from '../../../lib/ical';
import { verifyCronAuth } from '../../../lib/cron-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!verifyCronAuth(request)) return new Response('Unauthorized', { status: 401 });
  const results = await importAllActiveFeeds();
  return Response.json({ ok: true, results });
};

export const GET: APIRoute = async ({ request }) => {
  if (!verifyCronAuth(request)) return new Response('Unauthorized', { status: 401 });
  const results = await importAllActiveFeeds();
  return Response.json({ ok: true, results });
};
