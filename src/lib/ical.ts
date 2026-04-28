import ical from 'ical-generator';
import nodeIcal from 'node-ical';
import { eq, ne, and, isNull, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings, properties, icalFeeds, icalBlocks } from '../db/schema';

export async function buildPropertyIcal(propertyId: string): Promise<string> {
  const property = (await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1))[0];
  if (!property) throw new Error('property_not_found');
  const cal = ical({
    name: property.name,
    prodId: { company: 'retiro-dos-baeta', product: 'bookings' },
    timezone: 'Europe/Lisbon'
  });
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.propertyId, propertyId),
        ne(bookings.status, 'cancelled')
      )
    )
    .orderBy(asc(bookings.checkIn));
  for (const b of rows) {
    cal.createEvent({
      id: `booking-${b.id}@retiro-dos-baeta`,
      start: dateOnly(b.checkIn),
      end: dateOnly(b.checkOut),
      allDay: true,
      summary: `Reservado (${b.confirmationCode})`,
      description: `Hóspedes: ${b.numGuests} · Total: ${b.quotedPrice.toFixed(2)} ${b.currency}`,
      location: [property.city, property.region].filter(Boolean).join(', ') || undefined
    });
  }
  return cal.toString();
}

function dateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

interface ImportResult {
  feedId: string;
  status: 'ok' | 'error';
  imported?: number;
  removed?: number;
  error?: string;
}

export async function importIcalFeed(feedId: string): Promise<ImportResult> {
  const feed = (await db.select().from(icalFeeds).where(eq(icalFeeds.id, feedId)).limit(1))[0];
  if (!feed) return { feedId, status: 'error', error: 'feed_not_found' };
  try {
    const parsed = await nodeIcal.async.fromURL(feed.url);
    const events = Object.values(parsed).filter((e: any) => e.type === 'VEVENT') as any[];
    const seenUids = new Set<string>();
    let imported = 0;
    for (const ev of events) {
      const uid = ev.uid ?? `${ev.start?.toString() ?? ''}-${ev.end?.toString() ?? ''}`;
      seenUids.add(uid);
      const start = toIsoDate(ev.start);
      const end = toIsoDate(ev.end);
      if (!start || !end) continue;
      const summary = (ev.summary ?? '').toString().slice(0, 200);
      // upsert by feedId+sourceUid
      const existing = await db
        .select({ id: icalBlocks.id })
        .from(icalBlocks)
        .where(and(eq(icalBlocks.feedId, feed.id), eq(icalBlocks.sourceUid, uid)))
        .limit(1);
      if (existing.length) {
        await db
          .update(icalBlocks)
          .set({ startDate: start, endDate: end, summary, syncedAt: new Date(), deletedAt: null })
          .where(eq(icalBlocks.id, existing[0]!.id));
      } else {
        await db.insert(icalBlocks).values({
          feedId: feed.id,
          startDate: start,
          endDate: end,
          sourceUid: uid,
          summary
        });
      }
      imported++;
    }
    // Tombstone events that no longer appear
    const allBlocks = await db
      .select({ id: icalBlocks.id, sourceUid: icalBlocks.sourceUid })
      .from(icalBlocks)
      .where(and(eq(icalBlocks.feedId, feed.id), isNull(icalBlocks.deletedAt)));
    let removed = 0;
    for (const b of allBlocks) {
      if (!seenUids.has(b.sourceUid)) {
        await db.update(icalBlocks).set({ deletedAt: new Date() }).where(eq(icalBlocks.id, b.id));
        removed++;
      }
    }
    await db
      .update(icalFeeds)
      .set({ lastSyncedAt: new Date(), lastStatus: 'ok', lastError: null })
      .where(eq(icalFeeds.id, feed.id));
    return { feedId: feed.id, status: 'ok', imported, removed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(icalFeeds)
      .set({ lastSyncedAt: new Date(), lastStatus: 'error', lastError: message.slice(0, 300) })
      .where(eq(icalFeeds.id, feed.id));
    return { feedId: feed.id, status: 'error', error: message };
  }
}

export async function importAllActiveFeeds(): Promise<ImportResult[]> {
  const feeds = await db.select().from(icalFeeds).where(eq(icalFeeds.isActive, true));
  const results: ImportResult[] = [];
  for (const f of feeds) results.push(await importIcalFeed(f.id));
  return results;
}

function toIsoDate(d: any): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
