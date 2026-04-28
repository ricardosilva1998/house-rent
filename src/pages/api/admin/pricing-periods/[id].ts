import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { pricingPeriods } from '../../../../db/schema';

const Body = z.object({
  name: z.string().min(1).max(80).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nightlyRate: z.number().min(0).optional(),
  weekendRate: z.number().min(0).nullable().optional(),
  minStay: z.number().int().min(1).optional()
});

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id!;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  await db.update(pricingPeriods).set(parsed.data).where(eq(pricingPeriods.id, id));
  const rows = await db.select().from(pricingPeriods).where(eq(pricingPeriods.id, id)).limit(1);
  return Response.json({ ok: true, period: rows[0] });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id!;
  await db.delete(pricingPeriods).where(eq(pricingPeriods.id, id));
  return Response.json({ ok: true });
};
