import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { properties, propertyTranslations, auditLog } from '../../../db/schema';
import { getDefaultProperty } from '../../../lib/property';
import { createId } from '@paralleldrive/cuid2';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

const Body = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  region: z.string().max(80).nullable().optional(),
  country: z.string().min(2).max(2).default('PT'),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  maxGuests: z.number().int().min(1).max(50),
  bedrooms: z.number().int().min(0).max(50),
  beds: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  basePrice: z.number().min(0),
  currency: z.string().min(3).max(3).default('EUR'),
  checkInTime: z.string().default('15:00'),
  checkOutTime: z.string().default('11:00'),
  cancellationPolicy: z.string().nullable().optional(),
  houseRules: z.string().nullable().optional(),
  translations: z
    .array(
      z.object({
        locale: z.enum(['pt', 'en', 'es']),
        tagline: z.string().nullable().optional(),
        description: z.string().nullable().optional()
      })
    )
    .default([])
});

export const GET: APIRoute = async () => {
  const p = await getDefaultProperty();
  if (!p) return Response.json({ ok: true, property: null, translations: [] });
  const trs = await db.select().from(propertyTranslations).where(eq(propertyTranslations.propertyId, p.id));
  return Response.json({ ok: true, property: p, translations: trs });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  let p = await getDefaultProperty();
  const slug = p?.slug ?? (slugify(data.name) || createId().slice(0, 8));

  if (!p) {
    const inserted = await db
      .insert(properties)
      .values({
        slug,
        name: data.name,
        address: data.address ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        country: data.country,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        maxGuests: data.maxGuests,
        bedrooms: data.bedrooms,
        beds: data.beds,
        bathrooms: data.bathrooms,
        basePrice: data.basePrice,
        currency: data.currency,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        cancellationPolicy: data.cancellationPolicy ?? null,
        houseRules: data.houseRules ?? null
      })
      .returning();
    p = inserted[0]!;
  } else {
    await db
      .update(properties)
      .set({
        name: data.name,
        address: data.address ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        country: data.country,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        maxGuests: data.maxGuests,
        bedrooms: data.bedrooms,
        beds: data.beds,
        bathrooms: data.bathrooms,
        basePrice: data.basePrice,
        currency: data.currency,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        cancellationPolicy: data.cancellationPolicy ?? null,
        houseRules: data.houseRules ?? null,
        updatedAt: new Date()
      })
      .where(eq(properties.id, p.id));
  }

  for (const tr of data.translations) {
    const existing = await db
      .select({ propertyId: propertyTranslations.propertyId })
      .from(propertyTranslations)
      .where(eq(propertyTranslations.propertyId, p.id))
      .limit(50);
    const has = existing.find((e) => (e as any).locale === tr.locale);
    if (has) {
      await db
        .update(propertyTranslations)
        .set({ tagline: tr.tagline ?? null, description: tr.description ?? null })
        .where(eq(propertyTranslations.propertyId, p.id));
    } else {
      await db
        .insert(propertyTranslations)
        .values({
          propertyId: p.id,
          locale: tr.locale,
          tagline: tr.tagline ?? null,
          description: tr.description ?? null
        })
        .onConflictDoUpdate({
          target: [propertyTranslations.propertyId, propertyTranslations.locale],
          set: { tagline: tr.tagline ?? null, description: tr.description ?? null }
        });
    }
  }

  await db.insert(auditLog).values({
    actorUserId: locals.user?.id ?? null,
    action: 'property.update',
    entity: 'property',
    entityId: p.id,
    metadata: JSON.stringify({ name: data.name })
  });

  return Response.json({ ok: true, property: p });
};
