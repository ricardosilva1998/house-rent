// Guard: mock data must never run in production — it creates fake guests and bookings.
if (process.env.NODE_ENV === 'production') process.exit(0);

import { eq, count } from 'drizzle-orm';
import { db, client } from '../src/db/client';
import { users, bookings, pricingPeriods, properties } from '../src/db/schema';
import { hashPassword } from '../src/lib/auth';
import { generateConfirmationCode } from '../src/lib/pricing';

interface MockBooking {
  guestKey: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  total: number;
  status?: 'confirmed' | 'completed' | 'cancelled';
  source?: string;
  paymentStatus?: 'paid' | 'unpaid';
}

interface MockGuest {
  email: string;
  name: string;
  country: string;
  phone?: string;
  password: string;
}

const GUESTS: Record<string, MockGuest> = {
  maria:  { email: 'maria@example.com',  name: 'Maria Costa',     country: 'PT', phone: '+351 912 000 001', password: 'maria1234' },
  joao:   { email: 'joao@example.com',   name: 'João Pereira',    country: 'PT', phone: '+351 932 000 002', password: 'joao1234' },
  anna:   { email: 'anna@example.com',   name: 'Anna Schmidt',    country: 'DE', phone: '+49 151 0000 003', password: 'anna1234' },
  pierre: { email: 'pierre@example.com', name: 'Pierre Martin',   country: 'FR', phone: '+33 6 0000 0004',  password: 'pierre1234' },
  emma:   { email: 'emma@example.com',   name: 'Emma Wilson',     country: 'GB', phone: '+44 7900 000005',  password: 'emma1234' },
  carlos: { email: 'carlos@example.com', name: 'Carlos García',   country: 'ES', phone: '+34 600 000 006',  password: 'carlos1234' },
  raquel: { email: 'raquel@example.com', name: 'Raquel Santos',   country: 'PT', phone: '+351 962 000 007', password: 'raquel1234' }
};

// Anchored at "now" so the data stays plausibly recent regardless of when seeds run.
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const BOOKINGS: MockBooking[] = [
  // Past — last 14 months, varied seasons + countries
  { guestKey: 'maria',  checkIn: isoDaysFromToday(-360), checkOut: isoDaysFromToday(-353), numGuests: 4, total: 1260, status: 'completed', paymentStatus: 'paid', source: 'direct' },
  { guestKey: 'anna',   checkIn: isoDaysFromToday(-310), checkOut: isoDaysFromToday(-306), numGuests: 2, total: 540,  status: 'completed', paymentStatus: 'paid', source: 'airbnb' },
  { guestKey: 'pierre', checkIn: isoDaysFromToday(-260), checkOut: isoDaysFromToday(-256), numGuests: 3, total: 600,  status: 'completed', paymentStatus: 'paid', source: 'direct' },
  { guestKey: 'joao',   checkIn: isoDaysFromToday(-220), checkOut: isoDaysFromToday(-217), numGuests: 2, total: 360,  status: 'completed', paymentStatus: 'paid', source: 'direct' },
  { guestKey: 'raquel', checkIn: isoDaysFromToday(-190), checkOut: isoDaysFromToday(-185), numGuests: 5, total: 1100, status: 'completed', paymentStatus: 'paid', source: 'booking_com' },
  { guestKey: 'carlos', checkIn: isoDaysFromToday(-130), checkOut: isoDaysFromToday(-123), numGuests: 6, total: 1750, status: 'completed', paymentStatus: 'paid', source: 'direct' },
  { guestKey: 'emma',   checkIn: isoDaysFromToday(-90),  checkOut: isoDaysFromToday(-86),  numGuests: 2, total: 480,  status: 'completed', paymentStatus: 'paid', source: 'airbnb' },
  { guestKey: 'maria',  checkIn: isoDaysFromToday(-60),  checkOut: isoDaysFromToday(-57),  numGuests: 3, total: 420,  status: 'completed', paymentStatus: 'paid', source: 'direct' },
  { guestKey: 'anna',   checkIn: isoDaysFromToday(-30),  checkOut: isoDaysFromToday(-26),  numGuests: 2, total: 560,  status: 'completed', paymentStatus: 'paid', source: 'direct' },
  { guestKey: 'pierre', checkIn: isoDaysFromToday(-12),  checkOut: isoDaysFromToday(-8),   numGuests: 3, total: 640,  status: 'completed', paymentStatus: 'paid', source: 'direct' },

  // Upcoming — next 4 months, varied
  { guestKey: 'maria',  checkIn: isoDaysFromToday(12),   checkOut: isoDaysFromToday(16),   numGuests: 4, total: 720,  status: 'confirmed', source: 'direct' },
  { guestKey: 'raquel', checkIn: isoDaysFromToday(33),   checkOut: isoDaysFromToday(36),   numGuests: 2, total: 480,  status: 'confirmed', source: 'direct' },
  { guestKey: 'carlos', checkIn: isoDaysFromToday(54),   checkOut: isoDaysFromToday(61),   numGuests: 6, total: 1540, status: 'confirmed', source: 'booking_com' },
  { guestKey: 'emma',   checkIn: isoDaysFromToday(78),   checkOut: isoDaysFromToday(82),   numGuests: 3, total: 800,  status: 'confirmed', source: 'airbnb' },
  { guestKey: 'pierre', checkIn: isoDaysFromToday(110),  checkOut: isoDaysFromToday(117),  numGuests: 4, total: 1820, status: 'confirmed', source: 'direct' }
];

const PRICING_PERIODS = [
  // YYYY-MM-DD ranges anchored to current year ± 1
  { name: 'Época baixa · Inverno',    startDate: `${currentYear()}-01-01`, endDate: `${currentYear()}-03-31`, nightlyRate: 100, weekendRate: 130, minStay: 1 },
  { name: 'Época média · Primavera',  startDate: `${currentYear()}-04-01`, endDate: `${currentYear()}-06-30`, nightlyRate: 130, weekendRate: 160, minStay: 2 },
  { name: 'Época alta · Verão',       startDate: `${currentYear()}-07-01`, endDate: `${currentYear()}-08-31`, nightlyRate: 180, weekendRate: 220, minStay: 3 },
  { name: 'Época média · Outono',     startDate: `${currentYear()}-09-01`, endDate: `${currentYear()}-10-31`, nightlyRate: 130, weekendRate: 160, minStay: 2 },
  { name: 'Época baixa · Inverno II', startDate: `${currentYear()}-11-01`, endDate: `${currentYear()}-12-20`, nightlyRate: 100, weekendRate: 130, minStay: 1 },
  { name: 'Festas · Natal/Ano Novo',  startDate: `${currentYear()}-12-21`, endDate: `${currentYear()}-12-31`, nightlyRate: 220, weekendRate: 260, minStay: 4 }
];

function currentYear() { return new Date().getUTCFullYear(); }

async function ensureGuests() {
  const map = new Map<string, string>(); // key → userId
  for (const [key, g] of Object.entries(GUESTS)) {
    const existing = await db.select().from(users).where(eq(users.email, g.email)).limit(1);
    if (existing.length) {
      map.set(key, existing[0]!.id);
      continue;
    }
    const passwordHash = await hashPassword(g.password);
    const [created] = await db
      .insert(users)
      .values({
        email: g.email,
        name: g.name,
        country: g.country,
        phone: g.phone,
        passwordHash,
        role: 'guest',
        emailVerifiedAt: new Date(),
        locale: g.country === 'PT' ? 'pt' : g.country === 'ES' ? 'es' : 'en'
      })
      .returning({ id: users.id });
    map.set(key, created!.id);
  }
  return map;
}

async function ensurePricingPeriods(propertyId: string) {
  const existing = await db.select({ c: count() }).from(pricingPeriods).where(eq(pricingPeriods.propertyId, propertyId));
  if (existing[0] && existing[0].c > 0) return;
  for (const p of PRICING_PERIODS) {
    await db.insert(pricingPeriods).values({ propertyId, ...p });
  }
  console.log(`[mock] ${PRICING_PERIODS.length} pricing periods inserted`);
}

async function ensureMockBookings(propertyId: string, guestIds: Map<string, string>) {
  const existing = await db.select({ c: count() }).from(bookings).where(eq(bookings.propertyId, propertyId));
  if (existing[0] && existing[0].c > 0) {
    console.log(`[mock] bookings already present (${existing[0].c}); skipping`);
    return;
  }
  let inserted = 0;
  for (const b of BOOKINGS) {
    const userId = guestIds.get(b.guestKey);
    if (!userId) continue;
    const code = generateConfirmationCode();
    const createdOffsetDays = Math.max(7, Math.floor(Math.random() * 60) + 7);
    const createdAt = new Date(b.checkIn + 'T10:00:00Z');
    createdAt.setUTCDate(createdAt.getUTCDate() - createdOffsetDays);
    await db.insert(bookings).values({
      propertyId,
      userId,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      numGuests: b.numGuests,
      quotedPrice: b.total,
      currency: 'EUR',
      status: b.status ?? 'confirmed',
      confirmationCode: code,
      source: b.source ?? 'direct',
      paymentStatus: b.paymentStatus ?? null,
      paidAmount: b.paymentStatus === 'paid' ? b.total : null,
      paidAt: b.paymentStatus === 'paid' ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
      completedAt: b.status === 'completed' ? new Date(b.checkOut + 'T11:00:00Z') : null
    });
    inserted++;
  }
  console.log(`[mock] ${inserted} bookings inserted across ${guestIds.size} guests`);
}

async function main() {
  const property = (await db.select().from(properties).limit(1))[0];
  if (!property) {
    console.log('[mock] no property exists yet — run seed:placeholders first');
    client.close();
    return;
  }
  const guestIds = await ensureGuests();
  console.log(`[mock] ${guestIds.size} guest accounts ensured`);
  await ensurePricingPeriods(property.id);
  await ensureMockBookings(property.id, guestIds);
  client.close();
}

main().catch((err) => {
  console.error('[mock] failed', err);
  process.exit(1);
});
