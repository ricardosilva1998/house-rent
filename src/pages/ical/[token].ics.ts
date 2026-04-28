import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { properties } from '../../db/schema';
import { buildPropertyIcal } from '../../lib/ical';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const token = params.token!;
  const rows = await db.select().from(properties).where(eq(properties.icalExportToken, token)).limit(1);
  const property = rows[0];
  if (!property) return new Response('Not found', { status: 404 });
  const ics = await buildPropertyIcal(property.id);
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'public, max-age=300'
    }
  });
};
