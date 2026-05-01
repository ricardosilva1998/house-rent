import type { APIRoute } from 'astro';
import { getDefaultProperty } from '../../../lib/property';
import { suggestPricesForRange } from '../../../jobs/suggest-prices';
import { verifyCronAuth } from '../../../lib/cron-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  if (!verifyCronAuth(request)) return new Response('Unauthorized', { status: 401 });
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  const rawDays = Number(url.searchParams.get('days') ?? '30');
  // Clamp 1–90: suggestPricesForRange caps at 60 nights but an unbounded value
  // can produce Invalid Date or an oversized DB range scan before that guard fires.
  const days = Number.isFinite(rawDays) ? Math.min(90, Math.max(1, Math.round(rawDays))) : 30;
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + days);
  const to = future.toISOString().slice(0, 10);
  const result = await suggestPricesForRange({ propertyId: property.id, fromDate: today, toDate: to });
  return Response.json(result);
};
