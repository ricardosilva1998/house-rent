import type { APIRoute } from 'astro';
import { and, eq, gt, lt, ne, isNull } from 'drizzle-orm';
import { db } from '../../../db/client';
import { bookings, icalBlocks, icalFeeds } from '../../../db/schema';
import { getDefaultProperty } from '../../../lib/property';

export const GET: APIRoute = async () => {
  const property = await getDefaultProperty();
  if (!property) return Response.json({ ok: true, conflicts: [] });
  const blocks = await db
    .select({
      blockId: icalBlocks.id,
      feedName: icalFeeds.name,
      start: icalBlocks.startDate,
      end: icalBlocks.endDate,
      summary: icalBlocks.summary
    })
    .from(icalBlocks)
    .innerJoin(icalFeeds, eq(icalFeeds.id, icalBlocks.feedId))
    .where(and(eq(icalFeeds.propertyId, property.id), eq(icalFeeds.isActive, true), isNull(icalBlocks.deletedAt)));

  const conflicts: any[] = [];
  for (const b of blocks) {
    const overlap = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.propertyId, property.id),
          ne(bookings.status, 'cancelled'),
          lt(bookings.checkIn, b.end),
          gt(bookings.checkOut, b.start)
        )
      );
    for (const ov of overlap) {
      conflicts.push({
        blockId: b.blockId,
        feedName: b.feedName,
        blockStart: b.start,
        blockEnd: b.end,
        blockSummary: b.summary,
        bookingId: ov.id,
        confirmationCode: ov.confirmationCode,
        bookingCheckIn: ov.checkIn,
        bookingCheckOut: ov.checkOut
      });
    }
  }
  return Response.json({ ok: true, conflicts });
};
