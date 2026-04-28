import type { APIRoute } from 'astro';
import { z } from 'zod';
import { quoteRange } from '../../lib/pricing';
import { getDefaultProperty } from '../../lib/property';
import { rangeNights, isRangeAvailable } from '../../lib/availability';

const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(50).default(1)
});

export const GET: APIRoute = async ({ url }) => {
  const parsed = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });

  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 404 });

  if (parsed.data.guests > property.maxGuests) {
    return Response.json({ ok: false, error: 'too_many_guests', maxGuests: property.maxGuests }, { status: 400 });
  }

  const nights = rangeNights(parsed.data.from, parsed.data.to);
  if (nights < 1) return Response.json({ ok: false, error: 'invalid_range' }, { status: 400 });

  const available = await isRangeAvailable(property.id, parsed.data.from, parsed.data.to);
  const quote = await quoteRange(property.id, parsed.data.from, parsed.data.to);
  if (nights < quote.minStay) {
    return Response.json({ ok: false, error: 'min_stay', minStay: quote.minStay, nights });
  }

  return Response.json({
    ok: true,
    available,
    nights,
    ...quote
  });
};
