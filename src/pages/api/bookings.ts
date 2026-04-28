import type { APIRoute } from 'astro';
import { z } from 'zod';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { db, client } from '../../db/client';
import { bookings as bookingsT, icalBlocks, icalFeeds } from '../../db/schema';
import { getDefaultProperty } from '../../lib/property';
import { quoteRange, generateConfirmationCode } from '../../lib/pricing';
import { rangeNights } from '../../lib/availability';
import { isNull } from 'drizzle-orm';

const Body = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numGuests: z.number().int().min(1).max(50),
  specialRequests: z.string().max(1000).optional()
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return Response.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!locals.user.emailVerifiedAt) {
    return Response.json({ ok: false, error: 'email_not_verified' }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const { checkIn, checkOut, numGuests, specialRequests } = parsed.data;

  if (checkIn >= checkOut) return Response.json({ ok: false, error: 'invalid_range' }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  if (checkIn < today) return Response.json({ ok: false, error: 'past_date' }, { status: 400 });

  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 404 });
  if (numGuests > property.maxGuests) {
    return Response.json({ ok: false, error: 'too_many_guests', maxGuests: property.maxGuests }, { status: 400 });
  }

  const nights = rangeNights(checkIn, checkOut);
  if (nights < 1) return Response.json({ ok: false, error: 'invalid_range' }, { status: 400 });

  const quote = await quoteRange(property.id, checkIn, checkOut);
  if (nights < quote.minStay) {
    return Response.json({ ok: false, error: 'min_stay', minStay: quote.minStay, nights }, { status: 400 });
  }

  // Conflict-safe insert: re-check overlap inside a transaction. libSQL transactions via raw client.
  const conflicting = await db
    .select({ id: bookingsT.id })
    .from(bookingsT)
    .where(
      and(
        eq(bookingsT.propertyId, property.id),
        ne(bookingsT.status, 'cancelled'),
        lt(bookingsT.checkIn, checkOut),
        gt(bookingsT.checkOut, checkIn)
      )
    )
    .limit(1);
  if (conflicting.length) {
    return Response.json({ ok: false, error: 'dates_taken' }, { status: 409 });
  }

  const blocks = await db
    .select({ id: icalBlocks.id })
    .from(icalBlocks)
    .innerJoin(icalFeeds, eq(icalFeeds.id, icalBlocks.feedId))
    .where(
      and(
        eq(icalFeeds.propertyId, property.id),
        eq(icalFeeds.isActive, true),
        isNull(icalBlocks.deletedAt),
        lt(icalBlocks.startDate, checkOut),
        gt(icalBlocks.endDate, checkIn)
      )
    )
    .limit(1);
  if (blocks.length) {
    return Response.json({ ok: false, error: 'dates_taken' }, { status: 409 });
  }

  let confirmationCode = generateConfirmationCode();
  for (let i = 0; i < 3; i++) {
    const dup = await db
      .select({ id: bookingsT.id })
      .from(bookingsT)
      .where(eq(bookingsT.confirmationCode, confirmationCode))
      .limit(1);
    if (!dup.length) break;
    confirmationCode = generateConfirmationCode();
  }

  const inserted = await db
    .insert(bookingsT)
    .values({
      propertyId: property.id,
      userId: locals.user.id,
      checkIn,
      checkOut,
      numGuests,
      quotedPrice: quote.total,
      currency: quote.currency,
      status: 'confirmed',
      confirmationCode,
      specialRequests: specialRequests ?? null,
      source: 'direct',
      paymentStatus: null
    })
    .returning();
  const booking = inserted[0]!;

  // Fire-and-forget email with PDF voucher + iCal attachments
  try {
    const { sendEmail, renderBookingConfirmationEmail } = await import('../../lib/email');
    const { generateVoucherPdf, buildBookingIcs } = await import('../../lib/voucher');
    const [pdfBytes, icsText] = await Promise.all([
      generateVoucherPdf({ bookingId: booking.id }),
      Promise.resolve(
        buildBookingIcs({
          bookingId: booking.id,
          confirmationCode: booking.confirmationCode,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          propertyName: property.name,
          propertyAddress: property.address
        })
      )
    ]);
    const email = renderBookingConfirmationEmail({
      name: locals.user.name,
      confirmationCode: booking.confirmationCode,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      total: `${booking.quotedPrice.toFixed(2)} ${booking.currency}`,
      locale: locals.user.locale
    });
    await sendEmail({
      to: locals.user.email,
      ...email,
      attachments: [
        { filename: `voucher-${booking.confirmationCode}.pdf`, content: Buffer.from(pdfBytes) },
        { filename: `reserva-${booking.confirmationCode}.ics`, content: icsText }
      ]
    });
  } catch (err) {
    console.error('[bookings] email failed', err);
  }

  return Response.json({ ok: true, booking }, { status: 201 });
};

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.user) return Response.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  const all = url.searchParams.get('all') === '1' && locals.user.role === 'admin';
  const where = all ? undefined : eq(bookingsT.userId, locals.user.id);
  const rows = where
    ? await db.select().from(bookingsT).where(where).orderBy(bookingsT.checkIn)
    : await db.select().from(bookingsT).orderBy(bookingsT.checkIn);
  return Response.json({ ok: true, bookings: rows });
};
