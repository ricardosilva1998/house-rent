import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { db } from '../../../db/client';
import { competitorTargets } from '../../../db/schema';
import { getDefaultProperty } from '../../../lib/property';

const Body = z.object({
  url: z.string().url(),
  label: z.string().max(80).nullable().optional(),
  scrapeFrequency: z.enum(['daily', 'weekly']).default('daily'),
  selectorStrategy: z.enum(['auto', 'manual']).default('auto'),
  selectorRecipe: z.string().max(2000).nullable().optional(),
  notes: z.string().max(500).nullable().optional()
});

export const GET: APIRoute = async () => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: true, targets: [] });
  const rows = await db
    .select()
    .from(competitorTargets)
    .where(eq(competitorTargets.propertyId, property.id))
    .orderBy(asc(competitorTargets.createdAt));
  return Response.json({ ok: true, targets: rows });
};

export const POST: APIRoute = async ({ request }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const [row] = await db
    .insert(competitorTargets)
    .values({
      propertyId: property.id,
      url: parsed.data.url,
      label: parsed.data.label ?? null,
      scrapeFrequency: parsed.data.scrapeFrequency,
      selectorStrategy: parsed.data.selectorStrategy,
      selectorRecipe: parsed.data.selectorRecipe ?? null,
      notes: parsed.data.notes ?? null
    })
    .returning();
  return Response.json({ ok: true, target: row });
};
