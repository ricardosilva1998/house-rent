import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { db } from '../../../db/client';
import { pricingPeriods } from '../../../db/schema';
import { getDefaultProperty } from '../../../lib/property';

const Body = z.object({
  name: z.string().min(1).max(80),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nightlyRate: z.number().min(0),
  weekendRate: z.number().min(0).nullable().optional(),
  minStay: z.number().int().min(1).default(1)
});

export const GET: APIRoute = async () => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: true, periods: [] });
  const rows = await db
    .select()
    .from(pricingPeriods)
    .where(eq(pricingPeriods.propertyId, property.id))
    .orderBy(asc(pricingPeriods.startDate));
  return Response.json({ ok: true, periods: rows });
};

export const POST: APIRoute = async ({ request }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const [row] = await db
    .insert(pricingPeriods)
    .values({
      propertyId: property.id,
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      nightlyRate: parsed.data.nightlyRate,
      weekendRate: parsed.data.weekendRate ?? null,
      minStay: parsed.data.minStay
    })
    .returning();
  return Response.json({ ok: true, period: row });
};
