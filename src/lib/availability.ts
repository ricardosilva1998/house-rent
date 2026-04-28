import { and, eq, gt, gte, lt, lte, or, isNull, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings, icalBlocks, icalFeeds } from '../db/schema';

export interface BlockedRange {
  start: string;
  end: string;
  source: 'booking' | 'ical';
  ref?: string;
}

export interface AvailabilityResult {
  blocked: BlockedRange[];
  takenDates: Set<string>;
}

export function eachNight(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  while (d.getTime() < e.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}

export function isoDateAdd(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getAvailability(propertyId: string, from: string, to: string): Promise<AvailabilityResult> {
  const conflictingBookings = await db
    .select({
      id: bookings.id,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      status: bookings.status
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.propertyId, propertyId),
        ne(bookings.status, 'cancelled'),
        lt(bookings.checkIn, to),
        gt(bookings.checkOut, from)
      )
    );

  const conflictingBlocks = await db
    .select({
      id: icalBlocks.id,
      startDate: icalBlocks.startDate,
      endDate: icalBlocks.endDate,
      summary: icalBlocks.summary,
      feedId: icalBlocks.feedId
    })
    .from(icalBlocks)
    .innerJoin(icalFeeds, eq(icalFeeds.id, icalBlocks.feedId))
    .where(
      and(
        eq(icalFeeds.propertyId, propertyId),
        eq(icalFeeds.isActive, true),
        isNull(icalBlocks.deletedAt),
        lt(icalBlocks.startDate, to),
        gt(icalBlocks.endDate, from)
      )
    );

  const blocked: BlockedRange[] = [
    ...conflictingBookings.map((b) => ({ start: b.checkIn, end: b.checkOut, source: 'booking' as const, ref: b.id })),
    ...conflictingBlocks.map((b) => ({ start: b.startDate, end: b.endDate, source: 'ical' as const, ref: b.id }))
  ];

  const takenDates = new Set<string>();
  for (const b of blocked) {
    for (const night of eachNight(b.start, b.end)) takenDates.add(night);
  }

  return { blocked, takenDates };
}

export async function isRangeAvailable(propertyId: string, checkIn: string, checkOut: string): Promise<boolean> {
  const { blocked } = await getAvailability(propertyId, checkIn, checkOut);
  return blocked.length === 0;
}

export function rangeNights(checkIn: string, checkOut: string): number {
  const start = parseDate(checkIn).getTime();
  const end = parseDate(checkOut).getTime();
  return Math.max(0, Math.round((end - start) / (24 * 3600 * 1000)));
}

export function isWeekendNight(date: string): boolean {
  const d = parseDate(date);
  const dow = d.getUTCDay();
  return dow === 5 || dow === 6;
}
