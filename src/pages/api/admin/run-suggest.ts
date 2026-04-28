import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getDefaultProperty } from '../../../lib/property';
import { suggestPricesForRange } from '../../../jobs/suggest-prices';

const Body = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const POST: APIRoute = async ({ request }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const result = await suggestPricesForRange({
    propertyId: property.id,
    fromDate: parsed.data.fromDate,
    toDate: parsed.data.toDate
  });
  return Response.json(result);
};
