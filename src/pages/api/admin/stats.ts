import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getDefaultProperty } from '../../../lib/property';
import { computeStats } from '../../../lib/stats';

const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const GET: APIRoute = async ({ url }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 404 });
  const parsed = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_range' }, { status: 400 });
  const stats = await computeStats({ propertyId: property.id, from: parsed.data.from, to: parsed.data.to });
  return Response.json({ ok: true, stats });
};
