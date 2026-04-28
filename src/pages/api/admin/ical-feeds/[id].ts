import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { icalFeeds } from '../../../../db/schema';

const Body = z.object({
  name: z.string().min(1).max(80).optional(),
  url: z.string().url().optional(),
  isActive: z.boolean().optional()
});

export const PATCH: APIRoute = async ({ params, request }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  await db.update(icalFeeds).set(parsed.data).where(eq(icalFeeds.id, params.id!));
  const rows = await db.select().from(icalFeeds).where(eq(icalFeeds.id, params.id!)).limit(1);
  return Response.json({ ok: true, feed: rows[0] });
};

export const DELETE: APIRoute = async ({ params }) => {
  await db.delete(icalFeeds).where(eq(icalFeeds.id, params.id!));
  return Response.json({ ok: true });
};
