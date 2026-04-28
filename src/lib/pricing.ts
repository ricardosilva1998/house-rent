import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { priceSuggestions, pricingPeriods, properties } from '../db/schema';
import { eachNight, isWeekendNight } from './availability';

export interface NightlyPrice {
  date: string;
  price: number;
  source: 'suggestion' | 'period' | 'base';
}

export interface PriceQuote {
  total: number;
  currency: string;
  nightly: NightlyPrice[];
  minStay: number;
  warnings: string[];
}

export async function quoteRange(
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<PriceQuote> {
  const propRows = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
  const property = propRows[0];
  if (!property) throw new Error('property_not_found');

  const nights = eachNight(checkIn, checkOut);
  if (nights.length === 0) {
    return { total: 0, currency: property.currency, nightly: [], minStay: 1, warnings: ['empty_range'] };
  }

  const suggestions = await db
    .select({ date: priceSuggestions.date, accepted: priceSuggestions.acceptedPrice })
    .from(priceSuggestions)
    .where(
      and(
        eq(priceSuggestions.propertyId, propertyId),
        gte(priceSuggestions.date, nights[0]!),
        lte(priceSuggestions.date, nights[nights.length - 1]!)
      )
    );
  const suggestionByDate = new Map<string, number>();
  for (const s of suggestions) {
    if (typeof s.accepted === 'number') suggestionByDate.set(s.date, s.accepted);
  }

  const periods = await db
    .select()
    .from(pricingPeriods)
    .where(
      and(
        eq(pricingPeriods.propertyId, propertyId),
        lte(pricingPeriods.startDate, nights[nights.length - 1]!),
        gte(pricingPeriods.endDate, nights[0]!)
      )
    );

  const findPeriod = (date: string) =>
    periods.find((p) => p.startDate <= date && p.endDate >= date) ?? null;

  const nightly: NightlyPrice[] = [];
  let total = 0;
  let minStay = 1;
  const warnings: string[] = [];
  for (const date of nights) {
    let price: number;
    let source: NightlyPrice['source'];
    const accepted = suggestionByDate.get(date);
    if (typeof accepted === 'number') {
      price = accepted;
      source = 'suggestion';
    } else {
      const period = findPeriod(date);
      if (period) {
        if ((period.minStay ?? 1) > minStay) minStay = period.minStay ?? 1;
        const wknd = period.weekendRate;
        price = wknd != null && isWeekendNight(date) ? wknd : period.nightlyRate;
        source = 'period';
      } else {
        price = property.basePrice;
        source = 'base';
        warnings.push(`no_period_for_${date}`);
      }
    }
    total += price;
    nightly.push({ date, price, source });
  }

  return { total: Math.round(total * 100) / 100, currency: property.currency, nightly, minStay, warnings: dedupe(warnings) };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

export function generateConfirmationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out.slice(0, 4) + '-' + out.slice(4, 8);
}
