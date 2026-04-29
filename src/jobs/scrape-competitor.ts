import { eq, and, lt, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '../db/client';
import { competitorTargets, competitorSnapshots } from '../db/schema';
import { assertPublicUrl } from '../lib/net';

interface ScrapedPrice {
  date?: string;
  price: number;
  currency: string;
  confidence: 'high' | 'low';
  source: string;
}

interface ScrapeResult {
  targetId: string;
  status: 'ok' | 'error';
  prices?: ScrapedPrice[];
  error?: string;
}

const USER_AGENT = 'Mozilla/5.0 (compatible; RetiroDosBaeta-PriceCheck/1.0; +https://retiro-dos-baeta.example.com/about-bot)';

async function fetchHtml(url: string): Promise<string> {
  // Validate before fetching — defence-in-depth for targets already in the DB.
  await assertPublicUrl(url);
  const res = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'pt-PT,pt;q=0.9,en;q=0.8'
    },
    // Do not follow redirects automatically — a redirect to an internal address
    // would bypass the assertPublicUrl check above.
    redirect: 'manual'
  });
  if (res.status >= 300 && res.status < 400) throw new Error(`redirect_not_followed:${res.status}`);
  if (!res.ok) throw new Error(`http_${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
    throw new Error(`unexpected_content_type:${ct}`);
  }
  const text = await res.text();
  if (text.length > 4_000_000) throw new Error('payload_too_large');
  return text;
}

function parseJsonLdPrices(html: string): ScrapedPrice[] {
  const out: ScrapedPrice[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      const data = JSON.parse(match[1]!.trim());
      visitForOffers(data, out);
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return out;
}

function visitForOffers(node: any, out: ScrapedPrice[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) visitForOffers(item, out);
    return;
  }
  if (typeof node !== 'object') return;
  const t = node['@type'];
  const types = Array.isArray(t) ? t : [t];
  if (types.some((x) => typeof x === 'string' && x.toLowerCase().includes('offer'))) {
    const price = parseFloat(node.price ?? node.priceSpecification?.price ?? node.lowPrice ?? '');
    const currency = node.priceCurrency ?? node.priceSpecification?.priceCurrency ?? 'EUR';
    if (!Number.isNaN(price) && price > 0) {
      out.push({ price, currency, confidence: 'high', source: 'json-ld:Offer' });
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') visitForOffers(value, out);
  }
}

function parseMetaPrice(html: string): ScrapedPrice[] {
  const out: ScrapedPrice[] = [];
  const amount = /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i.exec(html);
  const currency = /<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (amount) {
    const p = parseFloat(amount[1]!);
    if (!Number.isNaN(p) && p > 0) {
      out.push({
        price: p,
        currency: currency?.[1] ?? 'EUR',
        confidence: 'high',
        source: 'og:product:price'
      });
    }
  }
  return out;
}

function parseManualRecipe(html: string, recipe: string): ScrapedPrice[] {
  // Recipe format: line-separated, e.g. "regex:/€\s?(\d{2,4}(?:[\.,]\d{2})?)/g" or "needle:€"
  const out: ScrapedPrice[] = [];
  for (const line of recipe.split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
    if (line.startsWith('regex:')) {
      const body = line.slice(6).trim();
      const m = /^\/(.+)\/([gimsuy]*)$/.exec(body);
      if (!m) continue;
      try {
        const re = new RegExp(m[1]!, m[2] || 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(html))) {
          const num = parseFloat((match[1] ?? '').replace(',', '.'));
          if (!Number.isNaN(num) && num > 0) {
            out.push({ price: num, currency: 'EUR', confidence: 'low', source: `regex:${m[1]}` });
          }
          if (out.length >= 60) break;
        }
      } catch {
        // bad regex
      }
    }
  }
  return out;
}

export async function scrapeTarget(targetId: string): Promise<ScrapeResult> {
  const rows = await db.select().from(competitorTargets).where(eq(competitorTargets.id, targetId)).limit(1);
  const target = rows[0];
  if (!target) return { targetId, status: 'error', error: 'target_not_found' };
  try {
    const html = await fetchHtml(target.url);
    let prices: ScrapedPrice[] = [
      ...parseJsonLdPrices(html),
      ...parseMetaPrice(html)
    ];
    if (target.selectorStrategy === 'manual' && target.selectorRecipe) {
      prices = prices.concat(parseManualRecipe(html, target.selectorRecipe));
    }
    if (prices.length === 0) {
      throw new Error('no_prices_found');
    }
    await db.insert(competitorSnapshots).values({
      targetId: target.id,
      status: 'ok',
      parsedPrices: JSON.stringify(prices.slice(0, 60)),
      rawHtmlRef: null
    });
    await db
      .update(competitorTargets)
      .set({ lastScrapedAt: new Date(), lastStatus: 'ok', lastError: null })
      .where(eq(competitorTargets.id, target.id));
    return { targetId, status: 'ok', prices };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(competitorSnapshots).values({
      targetId: target.id,
      status: 'error',
      parsedPrices: null,
      errorMessage: message
    });
    await db
      .update(competitorTargets)
      .set({ lastScrapedAt: new Date(), lastStatus: 'error', lastError: message })
      .where(eq(competitorTargets.id, target.id));
    return { targetId, status: 'error', error: message };
  }
}

export async function scrapeDueTargets(): Promise<ScrapeResult[]> {
  const now = new Date();
  const oneDay = 24 * 3600 * 1000;
  const sevenDays = 7 * oneDay;
  const targets = await db
    .select()
    .from(competitorTargets)
    .where(eq(competitorTargets.isActive, true));
  const due = targets.filter((t) => {
    if (!t.lastScrapedAt) return true;
    const ms = t.lastScrapedAt.getTime();
    const window = t.scrapeFrequency === 'weekly' ? sevenDays : oneDay;
    return now.getTime() - ms >= window;
  });
  const results: ScrapeResult[] = [];
  for (const t of due) {
    results.push(await scrapeTarget(t.id));
  }
  return results;
}
