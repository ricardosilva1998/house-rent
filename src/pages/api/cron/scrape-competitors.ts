import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';
import { scrapeDueTargets } from '../../../jobs/scrape-competitor';

export const prerender = false;

function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${env.CRON_SECRET}`;
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  const results = await scrapeDueTargets();
  return Response.json({ ok: true, results });
};

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  const results = await scrapeDueTargets();
  return Response.json({ ok: true, results });
};
