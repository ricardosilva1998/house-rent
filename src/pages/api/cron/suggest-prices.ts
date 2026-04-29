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
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + Number(url.searchParams.get('days') ?? '30'));
  const to = future.toISOString().slice(0, 10);
  const result = await suggestPricesForRange({ propertyId: property.id, fromDate: today, toDate: to });
  return Response.json(result);
};
