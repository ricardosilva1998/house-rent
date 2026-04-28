import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { propertyAmenities, properties } from '../../../db/schema';
import { getAllAmenities, getDefaultProperty, getPropertyAmenityIds } from '../../../lib/property';

async function resolveProperty(propertyId: string | null) {
  if (propertyId) {
    const rows = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    return rows[0] ?? null;
  }
  return getDefaultProperty();
}

const Body = z.object({ amenityIds: z.array(z.string()) });

export const GET: APIRoute = async ({ url }) => {
  const property = await resolveProperty(url.searchParams.get('propertyId'));
  const amenities = await getAllAmenities('pt');
  const selected = property ? Array.from(await getPropertyAmenityIds(property.id)) : [];
  return Response.json({ ok: true, amenities, selected });
};

export const PUT: APIRoute = async ({ request, url }) => {
  const property = await resolveProperty(url.searchParams.get('propertyId'));
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  await db.delete(propertyAmenities).where(eq(propertyAmenities.propertyId, property.id));
  if (parsed.data.amenityIds.length) {
    await db
      .insert(propertyAmenities)
      .values(parsed.data.amenityIds.map((amenityId) => ({ propertyId: property.id, amenityId })));
  }
  return Response.json({ ok: true });
};
