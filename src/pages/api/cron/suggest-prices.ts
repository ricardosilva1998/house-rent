import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';
import { getDefaultProperty } from '../../../lib/property';
import { suggestPricesForRange } from '../../../jobs/suggest-prices';

export const prerender = false;

function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${env.CRON_SECRET}`;
}

export const POST: APIRoute = async ({ request, url }) => {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + Number(url.searchParams.get('days') ?? '30'));
  const to = future.toISOString().slice(0, 10);
  const result = await suggestPricesForRange({ propertyId: property.id, fromDate: today, toDate: to });
  return Response.json(result);
};
