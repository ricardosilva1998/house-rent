import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq, gte, lte, and, asc } from 'drizzle-orm';
import { db } from '../../../db/client';
import { priceSuggestions } from '../../../db/schema';
import { getDefaultProperty } from '../../../lib/property';

const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const GET: APIRoute = async ({ url }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: true, suggestions: [] });
  const parsed = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_range' }, { status: 400 });
  const rows = await db
    .select()
    .from(priceSuggestions)
    .where(
      and(
        eq(priceSuggestions.propertyId, property.id),
        gte(priceSuggestions.date, parsed.data.from),
        lte(priceSuggestions.date, parsed.data.to)
      )
    )
    .orderBy(asc(priceSuggestions.date));
  return Response.json({ ok: true, suggestions: rows });
};

const PatchBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acceptedPrice: z.number().nonnegative().nullable()
});

export const PATCH: APIRoute = async ({ request, locals }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const parsed = PatchBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  await db
    .update(priceSuggestions)
    .set({
      acceptedPrice: parsed.data.acceptedPrice,
      acceptedByUserId: parsed.data.acceptedPrice != null ? locals.user?.id ?? null : null,
      acceptedAt: parsed.data.acceptedPrice != null ? new Date() : null
    })
    .where(and(eq(priceSuggestions.propertyId, property.id), eq(priceSuggestions.date, parsed.data.date)));
  return Response.json({ ok: true });
};
