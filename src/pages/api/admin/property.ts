import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq, asc, count } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../../db/client';
import { properties, propertyTranslations, auditLog, bookings } from '../../../db/schema';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || createId().slice(0, 8);
}

const PutBody = z.object({
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

const PostBody = z.object({
  name: z.string().min(1).max(120),
  city: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  country: z.string().min(2).max(2).default('PT')
});

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (id) {
    const rows = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    if (!rows.length) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    const trs = await db.select().from(propertyTranslations).where(eq(propertyTranslations.propertyId, id));
    return Response.json({ ok: true, property: rows[0], translations: trs });
  }
  const list = await db.select().from(properties).orderBy(asc(properties.createdAt));
  // Tag the first as default for the public site
  return Response.json({
    ok: true,
    properties: list.map((p, i) => ({ ...p, isDefault: i === 0 }))
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const parsed = PostBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const slug = slugify(parsed.data.name);
  const [created] = await db
    .insert(properties)
    .values({
      slug,
      name: parsed.data.name,
      city: parsed.data.city ?? null,
      region: parsed.data.region ?? null,
      country: parsed.data.country
    })
    .returning();
  await db.insert(auditLog).values({
    actorUserId: locals.user?.id ?? null,
    action: 'property.create',
    entity: 'property',
    entityId: created!.id,
    metadata: JSON.stringify({ name: parsed.data.name })
  });
  return Response.json({ ok: true, property: created });
};

export const PUT: APIRoute = async ({ request, url, locals }) => {
  const id = url.searchParams.get('id');
  const parsed = PutBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  let p = id
    ? (await db.select().from(properties).where(eq(properties.id, id)).limit(1))[0]
    : (await db.select().from(properties).orderBy(asc(properties.createdAt)).limit(1))[0];
  if (!p) {
    // First-run: create
    const slug = slugify(data.name);
    const [created] = await db
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
    p = created!;
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

  await db.insert(auditLog).values({
    actorUserId: locals.user?.id ?? null,
    action: 'property.update',
    entity: 'property',
    entityId: p.id,
    metadata: JSON.stringify({ name: data.name })
  });

  return Response.json({ ok: true, property: p });
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'no_id' }, { status: 400 });
  const bk = await db.select({ c: count() }).from(bookings).where(eq(bookings.propertyId, id));
  if (bk[0] && bk[0].c > 0) {
    return Response.json({ ok: false, error: 'has_bookings', bookings: bk[0].c }, { status: 409 });
  }
  await db.delete(properties).where(eq(properties.id, id));
  await db.insert(auditLog).values({
    actorUserId: locals.user?.id ?? null,
    action: 'property.delete',
    entity: 'property',
    entityId: id,
    metadata: null
  });
  return Response.json({ ok: true });
};
