import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { db } from '../../../db/client';
import { icalFeeds } from '../../../db/schema';
import { getDefaultProperty } from '../../../lib/property';

const Body = z.object({
  name: z.string().min(1).max(80),
  url: z.string().url()
});

export const GET: APIRoute = async () => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: true, feeds: [], exportToken: null });
  const feeds = await db
    .select()
    .from(icalFeeds)
    .where(eq(icalFeeds.propertyId, property.id))
    .orderBy(asc(icalFeeds.createdAt));
  return Response.json({ ok: true, feeds, exportToken: property.icalExportToken });
};

export const POST: APIRoute = async ({ request }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const [row] = await db
    .insert(icalFeeds)
    .values({ propertyId: property.id, name: parsed.data.name, url: parsed.data.url })
    .returning();
  return Response.json({ ok: true, feed: row });
};
