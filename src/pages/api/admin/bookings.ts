import type { APIRoute } from 'astro';
import { z } from 'zod';
import { and, eq, gte, lte, like, or, ne, gt, lt } from 'drizzle-orm';
import { db } from '../../../db/client';
import { bookings, users, properties, auditLog, icalBlocks, icalFeeds } from '../../../db/schema';
import { isNull } from 'drizzle-orm';
import { getDefaultProperty } from '../../../lib/property';
import { quoteRange, generateConfirmationCode } from '../../../lib/pricing';
import { rangeNights } from '../../../lib/availability';

export const GET: APIRoute = async ({ url }) => {
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const search = url.searchParams.get('search');

  const conditions = [] as any[];
  if (status) conditions.push(eq(bookings.status, status as any));
  if (from) conditions.push(gte(bookings.checkIn, from));
  if (to) conditions.push(lte(bookings.checkOut, to));
  if (search) {
    conditions.push(
      or(
        like(bookings.confirmationCode, `%${search}%`),
        like(users.email, `%${search.toLowerCase()}%`),
        like(users.name, `%${search}%`)
      )
    );
  }

  const rows = await db
    .select({
      booking: bookings,
      userName: users.name,
      userEmail: users.email
    })
    .from(bookings)
    .leftJoin(users, eq(users.id, bookings.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(bookings.checkIn);

  return Response.json({
    ok: true,
    bookings: rows.map((r) => ({ ...r.booking, userName: r.userName, userEmail: r.userEmail }))
  });
};

const CreateBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numGuests: z.number().int().min(1).max(50),
  source: z.string().max(40).default('admin'),
  specialRequests: z.string().max(1000).optional(),
  override_price: z.number().nonnegative().optional()
});

export const POST: APIRoute = async ({ request, locals }) => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: false, error: 'no_property' }, { status: 400 });
  const parsed = CreateBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  const data = parsed.data;
  if (data.checkIn >= data.checkOut) return Response.json({ ok: false, error: 'invalid_range' }, { status: 400 });

  // Find or create guest user (no password — they can claim later)
  let userRows = await db.select().from(users).where(eq(users.email, data.email.toLowerCase())).limit(1);
  let user = userRows[0];
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash: 'admin-created-no-pw',
        role: 'guest',
        emailVerifiedAt: new Date(),
        locale: 'pt'
      })
      .returning();
    user = created!;
  }

  // Conflict check
  const conflict = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.propertyId, property.id),
        ne(bookings.status, 'cancelled'),
        lt(bookings.checkIn, data.checkOut),
        gt(bookings.checkOut, data.checkIn)
      )
    )
    .limit(1);
  if (conflict.length) return Response.json({ ok: false, error: 'dates_taken' }, { status: 409 });
  const blockConflict = await db
    .select({ id: icalBlocks.id })
    .from(icalBlocks)
    .innerJoin(icalFeeds, eq(icalFeeds.id, icalBlocks.feedId))
    .where(
      and(
        eq(icalFeeds.propertyId, property.id),
        eq(icalFeeds.isActive, true),
        isNull(icalBlocks.deletedAt),
        lt(icalBlocks.startDate, data.checkOut),
        gt(icalBlocks.endDate, data.checkIn)
      )
    )
    .limit(1);
  if (blockConflict.length) return Response.json({ ok: false, error: 'dates_taken' }, { status: 409 });

  const quote = await quoteRange(property.id, data.checkIn, data.checkOut);
  const total = data.override_price ?? quote.total;
  const code = generateConfirmationCode();
  const [booking] = await db
    .insert(bookings)
    .values({
      propertyId: property.id,
      userId: user.id,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      numGuests: data.numGuests,
      quotedPrice: total,
      currency: quote.currency,
      status: 'confirmed',
      confirmationCode: code,
      specialRequests: data.specialRequests ?? null,
      source: data.source
    })
    .returning();

  await db.insert(auditLog).values({
    actorUserId: locals.user?.id ?? null,
    action: 'booking.create_admin',
    entity: 'booking',
    entityId: booking!.id,
    metadata: JSON.stringify({ for: data.email, range: `${data.checkIn}→${data.checkOut}`, total })
  });

  return Response.json({ ok: true, booking });
};
