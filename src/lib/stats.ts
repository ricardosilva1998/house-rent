import { and, eq, gte, lte, ne, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings, users } from '../db/schema';
import { eachNight, rangeNights } from './availability';

interface StatsInput {
  propertyId: string;
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
}

export interface StatsResult {
  range: { from: string; to: string; nights: number };
  occupancyRate: number;
  bookedNights: number;
  revenue: number;
  adr: number;
  bookingsCount: number;
  averageLeadTime: number;
  averageLengthOfStay: number;
  guestsByCountry: { country: string; count: number; bookings: number }[];
  repeatRate: number;
  monthly: { month: string; bookedNights: number; revenue: number }[];
}

export async function computeStats(input: StatsInput): Promise<StatsResult> {
  const { propertyId, from, to } = input;
  const allRows = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      quotedPrice: bookings.quotedPrice,
      currency: bookings.currency,
      status: bookings.status,
      createdAt: bookings.createdAt,
      country: users.country
    })
    .from(bookings)
    .leftJoin(users, eq(users.id, bookings.userId))
    .where(
      and(
        eq(bookings.propertyId, propertyId),
        ne(bookings.status, 'cancelled'),
        gte(bookings.checkOut, from),
        lte(bookings.checkIn, to)
      )
    )
    .orderBy(asc(bookings.checkIn));

  // Inclusive end → use one-past-last-day boundary for night iteration
  const toExclusive = nextDay(to);
  const totalNights = rangeNights(from, toExclusive);

  let bookedNights = 0;
  let revenue = 0;
  let losTotal = 0;
  let leadTotal = 0;
  let leadCount = 0;
  const monthly = new Map<string, { bookedNights: number; revenue: number }>();
  const countries = new Map<string, { count: number; bookings: number }>();
  const userBookings = new Map<string, number>();

  for (const b of allRows) {
    const nightsInRange = eachNight(b.checkIn, b.checkOut).filter((n) => n >= from && n <= to);
    if (nightsInRange.length === 0) continue;
    const totalBookingNights = rangeNights(b.checkIn, b.checkOut);
    bookedNights += nightsInRange.length;
    const proRated = totalBookingNights > 0 ? (b.quotedPrice * nightsInRange.length) / totalBookingNights : 0;
    revenue += proRated;
    losTotal += totalBookingNights;
    if (b.createdAt) {
      const lead = Math.round(
        (new Date(b.checkIn + 'T00:00:00Z').getTime() - new Date(b.createdAt).getTime()) / (24 * 3600 * 1000)
      );
      if (Number.isFinite(lead)) {
        leadTotal += lead;
        leadCount++;
      }
    }
    for (const n of nightsInRange) {
      const month = n.slice(0, 7);
      const m = monthly.get(month) ?? { bookedNights: 0, revenue: 0 };
      m.bookedNights += 1;
      m.revenue += proRated / nightsInRange.length;
      monthly.set(month, m);
    }
    const country = (b.country ?? '—').toUpperCase();
    const c = countries.get(country) ?? { count: 0, bookings: 0 };
    c.bookings += 1;
    countries.set(country, c);
    userBookings.set(b.userId, (userBookings.get(b.userId) ?? 0) + 1);
  }

  // unique guest counts per country (post-loop using a fresh pass)
  const userCountry = new Map<string, string>();
  for (const b of allRows) userCountry.set(b.userId, (b.country ?? '—').toUpperCase());
  for (const [, country] of userCountry) {
    const c = countries.get(country) ?? { count: 0, bookings: 0 };
    c.count += 1;
    countries.set(country, c);
  }

  const totalUsers = userBookings.size;
  const repeating = Array.from(userBookings.values()).filter((n) => n > 1).length;
  const repeatRate = totalUsers ? repeating / totalUsers : 0;

  return {
    range: { from, to, nights: totalNights },
    occupancyRate: totalNights ? bookedNights / totalNights : 0,
    bookedNights,
    revenue: round2(revenue),
    adr: bookedNights ? round2(revenue / bookedNights) : 0,
    bookingsCount: allRows.length,
    averageLeadTime: leadCount ? Math.round(leadTotal / leadCount) : 0,
    averageLengthOfStay: allRows.length ? round2(losTotal / allRows.length) : 0,
    guestsByCountry: Array.from(countries.entries())
      .map(([country, v]) => ({ country, count: v.count, bookings: v.bookings }))
      .sort((a, b) => b.bookings - a.bookings),
    repeatRate,
    monthly: Array.from(monthly.entries())
      .map(([month, v]) => ({ month, bookedNights: v.bookedNights, revenue: round2(v.revenue) }))
      .sort((a, b) => a.month.localeCompare(b.month))
  };
}

function nextDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
