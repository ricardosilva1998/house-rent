import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { competitorTargets } from '../../../../db/schema';

const Body = z.object({
  url: z.string().url().optional(),
  label: z.string().max(80).nullable().optional(),
  scrapeFrequency: z.enum(['daily', 'weekly']).optional(),
  selectorStrategy: z.enum(['auto', 'manual']).optional(),
  selectorRecipe: z.string().max(2000).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional()
});

export const PATCH: APIRoute = async ({ params, request }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  await db.update(competitorTargets).set(parsed.data).where(eq(competitorTargets.id, params.id!));
  const rows = await db.select().from(competitorTargets).where(eq(competitorTargets.id, params.id!)).limit(1);
  return Response.json({ ok: true, target: rows[0] });
};

export const DELETE: APIRoute = async ({ params }) => {
  await db.delete(competitorTargets).where(eq(competitorTargets.id, params.id!));
  return Response.json({ ok: true });
};
