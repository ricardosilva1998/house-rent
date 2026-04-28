import { eq } from 'drizzle-orm';
import { db, client } from '../src/db/client';
import { properties, propertyTranslations, propertyPhotos, propertyAmenities, amenities } from '../src/db/schema';

const PHOTOS: { url: string; alt: string; sort: number }[] = [
  { url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1600&q=80', alt: 'Casa de campo em pedra', sort: 0 },
  { url: 'https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?w=1600&q=80', alt: 'Vista para a serra', sort: 1 },
  { url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600&q=80', alt: 'Sala acolhedora', sort: 2 },
  { url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600&q=80', alt: 'Quarto com vista', sort: 3 },
  { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80', alt: 'Cozinha em pedra', sort: 4 },
  { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80', alt: 'Mesa de jantar', sort: 5 },
  { url: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1600&q=80', alt: 'Lareira tradicional', sort: 6 },
  { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&q=80', alt: 'Quarto principal', sort: 7 },
  { url: 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1600&q=80', alt: 'Vista do exterior', sort: 8 },
  { url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=1600&q=80', alt: 'Caminho de pedra', sort: 9 }
];

const TRANSLATIONS = {
  pt: {
    tagline: 'Uma casa de campo na serra, para descansar com calma.',
    description:
      'Casa típica em pedra, restaurada com carinho, ideal para famílias e pequenos grupos. ' +
      'Lareira para o inverno, terraço para os jantares de verão e os passeios pela serra a poucos minutos. ' +
      'Cozinha equipada, três quartos confortáveis, e o silêncio do interior português.'
  },
  en: {
    tagline: 'A countryside stone house in the mountains, perfect for slow getaways.',
    description:
      'A traditional stone house, lovingly restored, ideal for families and small groups. ' +
      'Fireplace for the winter, terrace for summer dinners, and mountain trails just minutes away. ' +
      'Equipped kitchen, three comfortable bedrooms, and the quiet of inland Portugal.'
  },
  es: {
    tagline: 'Una casa de campo en la sierra, perfecta para escapadas tranquilas.',
    description:
      'Casa tradicional de piedra, restaurada con cariño, ideal para familias y grupos pequeños. ' +
      'Chimenea para el invierno, terraza para las cenas de verano y rutas de montaña a pocos minutos. ' +
      'Cocina equipada, tres habitaciones confortables y el silencio del interior portugués.'
  }
};

const DEFAULT_AMENITY_KEYS = [
  'wifi', 'kitchen', 'parking', 'fireplace', 'bbq',
  'washing_machine', 'heating', 'garden', 'family_friendly', 'pets_allowed'
];

async function ensureProperty() {
  const existing = (await db.select().from(properties).limit(1))[0];
  if (existing) return existing;
  const [created] = await db
    .insert(properties)
    .values({
      slug: 'retiro-dos-baeta',
      name: 'Retiro dos Baeta',
      address: null,
      city: 'Manteigas',
      region: 'Serra da Estrela',
      country: 'PT',
      maxGuests: 6,
      bedrooms: 3,
      beds: 4,
      bathrooms: 2,
      basePrice: 120,
      currency: 'EUR',
      checkInTime: '15:00',
      checkOutTime: '11:00',
      cancellationPolicy: 'Cancelamento gratuito até 7 dias antes do check-in. Após esse prazo, contacte-nos.',
      houseRules: 'Sem festas. Animais permitidos com aviso prévio. Respeite o sossego dos vizinhos a partir das 22h.'
    })
    .returning();
  console.log(`[seed] created property ${created!.id} (${created!.slug})`);
  return created!;
}

async function ensureTranslations(propertyId: string) {
  for (const [locale, t] of Object.entries(TRANSLATIONS)) {
    await db
      .insert(propertyTranslations)
      .values({ propertyId, locale, tagline: t.tagline, description: t.description })
      .onConflictDoNothing();
  }
  console.log('[seed] translations ensured');
}

async function ensurePhotos(propertyId: string) {
  const existing = await db.select({ id: propertyPhotos.id }).from(propertyPhotos).where(eq(propertyPhotos.propertyId, propertyId));
  if (existing.length >= PHOTOS.length) {
    console.log('[seed] photos already present, skipping');
    return;
  }
  if (existing.length > 0) {
    console.log(`[seed] photos partially present (${existing.length}); leaving as-is`);
    return;
  }
  for (const p of PHOTOS) {
    await db.insert(propertyPhotos).values({
      propertyId,
      url: p.url,
      altText: p.alt,
      sortOrder: p.sort
    });
  }
  console.log(`[seed] inserted ${PHOTOS.length} placeholder photos`);
}

async function ensureAmenities(propertyId: string) {
  const existing = await db
    .select({ amenityId: propertyAmenities.amenityId })
    .from(propertyAmenities)
    .where(eq(propertyAmenities.propertyId, propertyId));
  if (existing.length > 0) return;
  const matchingAmenities = await db.select().from(amenities);
  const wanted = new Set(DEFAULT_AMENITY_KEYS);
  const toAdd = matchingAmenities.filter((a) => wanted.has(a.key));
  if (toAdd.length === 0) {
    console.log('[seed] no amenities seeded yet — run seed:amenities first');
    return;
  }
  for (const a of toAdd) {
    await db.insert(propertyAmenities).values({ propertyId, amenityId: a.id }).onConflictDoNothing();
  }
  console.log(`[seed] linked ${toAdd.length} amenities to property`);
}

async function main() {
  const property = await ensureProperty();
  await ensureTranslations(property.id);
  await ensurePhotos(property.id);
  await ensureAmenities(property.id);
  client.close();
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
