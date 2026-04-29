import type { APIRoute } from 'astro';
import { scrapeDueTargets } from '../../../jobs/scrape-competitor';
import { verifyCronAuth } from '../../../lib/cron-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!verifyCronAuth(request)) return new Response('Unauthorized', { status: 401 });
  const results = await scrapeDueTargets();
  return Response.json({ ok: true, results });
};

export const GET: APIRoute = async ({ request }) => {
  if (!verifyCronAuth(request)) return new Response('Unauthorized', { status: 401 });
  const results = await scrapeDueTargets();
  return Response.json({ ok: true, results });
};
