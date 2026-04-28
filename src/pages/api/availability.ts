import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getAvailability } from '../../lib/availability';
import { getDefaultProperty } from '../../lib/property';

const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const GET: APIRoute = async ({ url }) => {
  const parsed = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_range' }, { status: 400 });

  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: true, blocked: [], takenDates: [] });

  const { blocked, takenDates } = await getAvailability(property.id, parsed.data.from, parsed.data.to);
  return Response.json({
    ok: true,
    propertyId: property.id,
    blocked,
    takenDates: Array.from(takenDates).sort()
  });
};
