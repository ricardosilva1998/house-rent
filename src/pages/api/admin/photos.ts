import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../db/client';
import { propertyPhotos } from '../../../db/schema';
import { getDefaultProperty, getPropertyPhotos } from '../../../lib/property';

const PostBody = z.object({
  url: z.string().url(),
  altText: z.string().max(200).optional()
});

const ReorderBody = z.object({
  order: z.array(z.string())
});

export const GET: APIRoute = async () => {
  const p = await getDefaultProperty();
  if (!p) return Response.json({ ok: true, photos: [] });
  const photos = await getPropertyPhotos(p.id);
  return Response.json({ ok: true, photos });
};

export const POST: APIRoute = async ({ request }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const parsed = PostBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const max = await db
    .select({ s: propertyPhotos.sortOrder })
    .from(propertyPhotos)
    .where(eq(propertyPhotos.propertyId, property.id))
    .orderBy(propertyPhotos.sortOrder);
  const next = max.length ? Math.max(...max.map((m) => m.s ?? 0)) + 1 : 0;
  const inserted = await db
    .insert(propertyPhotos)
    .values({
      propertyId: property.id,
      url: parsed.data.url,
      altText: parsed.data.altText ?? null,
      sortOrder: next
    })
    .returning();
  return Response.json({ ok: true, photo: inserted[0] });
};

export const PATCH: APIRoute = async ({ request }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const parsed = ReorderBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  for (let i = 0; i < parsed.data.order.length; i++) {
    const id = parsed.data.order[i]!;
    await db
      .update(propertyPhotos)
      .set({ sortOrder: i })
      .where(and(eq(propertyPhotos.id, id), eq(propertyPhotos.propertyId, property.id)));
  }
  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'no_id' }, { status: 400 });
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  await db
    .delete(propertyPhotos)
    .where(and(eq(propertyPhotos.id, id), eq(propertyPhotos.propertyId, property.id)));
  return Response.json({ ok: true });
};
