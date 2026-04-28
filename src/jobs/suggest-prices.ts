import Anthropic from '@anthropic-ai/sdk';
import { eq, and, gte, lte, desc, asc, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import {
  priceSuggestions,
  pricingPeriods,
  competitorTargets,
  competitorSnapshots,
  bookings,
  holidays,
  properties
} from '../db/schema';
import { eachNight, isWeekendNight } from '../lib/availability';
import { env } from '../lib/env';

interface SuggestionInput {
  propertyId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

interface SuggestionContextRow {
  date: string;
  weekday: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  inSeason: string | null;
  fallbackRate: number;
  recentBookingsAtDate: number;
  comparatorPrices: number[];
}

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const SYSTEM_PROMPT = `You are an expert pricing analyst for a single Portuguese countryside vacation rental ("Retiro dos Baeta").
Given context for a list of dates — including the seasonal fallback rate, day of week, holidays, recent demand signals, and competitor snapshot prices — return a JSON array with one object per date in the form:
{
  "date": "YYYY-MM-DD",
  "suggested_price": <number EUR rounded to whole euro>,
  "reasoning": "<short Portuguese sentence explaining the call>"
}

Rules:
- Output ONLY JSON. No prose, no markdown, no code fences.
- Suggested price should be in EUR, rounded to whole numbers, between 50 and 1500.
- If competitor prices are present, anchor near their median, then adjust ±10–25% based on demand signals (holidays, weekends, lead time).
- If no competitor data, anchor to the fallback rate and apply: weekend +10%, holiday +15–25%, otherwise hold.
- Keep reasoning under 110 characters in Portuguese.`;

export async function suggestPricesForRange(input: SuggestionInput) {
  if (!client) {
    return { ok: false, error: 'no_api_key', count: 0 };
  }
  const property = (await db.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1))[0];
  if (!property) return { ok: false, error: 'no_property', count: 0 };

  const dates = eachNight(input.fromDate, input.toDate);
  if (dates.length === 0) return { ok: false, error: 'empty_range', count: 0 };
  if (dates.length > 60) {
    return { ok: false, error: 'range_too_large', count: 0 };
  }

  const periods = await db
    .select()
    .from(pricingPeriods)
    .where(
      and(
        eq(pricingPeriods.propertyId, input.propertyId),
        lte(pricingPeriods.startDate, dates[dates.length - 1]!),
        gte(pricingPeriods.endDate, dates[0]!)
      )
    );

  const holRows = await db
    .select()
    .from(holidays)
    .where(
      and(
        eq(holidays.country, property.country ?? 'PT'),
        gte(holidays.date, dates[0]!),
        lte(holidays.date, dates[dates.length - 1]!)
      )
    );
  const holMap = new Map(holRows.map((h) => [h.date, h.name]));

  const recentBookings = await db
    .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
    .from(bookings)
    .where(and(eq(bookings.propertyId, input.propertyId)));
  const bookedDates = new Map<string, number>();
  for (const b of recentBookings) {
    for (const n of eachNight(b.checkIn, b.checkOut)) bookedDates.set(n, (bookedDates.get(n) ?? 0) + 1);
  }

  const targets = await db
    .select()
    .from(competitorTargets)
    .where(and(eq(competitorTargets.propertyId, input.propertyId), eq(competitorTargets.isActive, true)));
  const recentSnapshots: number[] = [];
  for (const t of targets) {
    const last = await db
      .select()
      .from(competitorSnapshots)
      .where(and(eq(competitorSnapshots.targetId, t.id), eq(competitorSnapshots.status, 'ok')))
      .orderBy(desc(competitorSnapshots.scrapedAt))
      .limit(1);
    const snap = last[0];
    if (!snap?.parsedPrices) continue;
    try {
      const arr = JSON.parse(snap.parsedPrices) as Array<{ price: number; confidence?: string }>;
      for (const p of arr) {
        if (p.price > 30 && p.price < 2000) recentSnapshots.push(p.price);
      }
    } catch {
      // skip malformed snapshot
    }
  }
  const comparatorPrices = trimOutliers(recentSnapshots).slice(0, 40);

  const context: SuggestionContextRow[] = dates.map((d) => {
    const weekday = new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short' });
    const period = periods.find((p) => p.startDate <= d && p.endDate >= d) ?? null;
    const fallback =
      period && isWeekendNight(d) && period.weekendRate != null ? period.weekendRate :
      period ? period.nightlyRate :
      property.basePrice;
    return {
      date: d,
      weekday,
      isWeekend: isWeekendNight(d),
      isHoliday: holMap.has(d),
      holidayName: holMap.get(d),
      inSeason: period?.name ?? null,
      fallbackRate: Math.round(fallback),
      recentBookingsAtDate: bookedDates.get(d) ?? 0,
      comparatorPrices: comparatorPrices.slice(0, 12)
    };
  });

  const userPayload = JSON.stringify({
    property: {
      name: property.name,
      city: property.city,
      region: property.region,
      base_price: property.basePrice,
      currency: property.currency
    },
    dates: context
  });

  const response = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{ role: 'user', content: userPayload }]
  });

  const text = response.content
    .map((c: any) => (c.type === 'text' ? c.text : ''))
    .join('')
    .trim();

  let parsed: Array<{ date: string; suggested_price: number; reasoning?: string }> = [];
  try {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return { ok: false, error: 'invalid_ai_output', preview: text.slice(0, 200), count: 0 };
  }

  let count = 0;
  for (const item of parsed) {
    if (!item.date || !Number.isFinite(item.suggested_price)) continue;
    const ctx = context.find((c) => c.date === item.date);
    const comparatorSummary = ctx
      ? `comp_n=${ctx.comparatorPrices.length} fallback=${ctx.fallbackRate} weekend=${ctx.isWeekend} holiday=${ctx.holidayName ?? ''}`
      : null;
    await db
      .insert(priceSuggestions)
      .values({
        propertyId: input.propertyId,
        date: item.date,
        suggestedPrice: Math.round(item.suggested_price),
        currency: property.currency,
        reasoning: item.reasoning ?? null,
        comparatorSummary
      })
      .onConflictDoUpdate({
        target: [priceSuggestions.propertyId, priceSuggestions.date],
        set: {
          suggestedPrice: Math.round(item.suggested_price),
          reasoning: item.reasoning ?? null,
          comparatorSummary
        }
      });
    count++;
  }
  return { ok: true, count };
}

function trimOutliers(values: number[]): number[] {
  if (values.length < 4) return values.slice().sort((a, b) => a - b);
  const sorted = values.slice().sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.1);
  return sorted.slice(cut, sorted.length - cut);
}
