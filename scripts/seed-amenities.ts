import { eq } from 'drizzle-orm';
import { db, client } from '../src/db/client';
import { amenities, amenityTranslations } from '../src/db/schema';

const CATALOG: Array<{ key: string; icon: string; labels: { pt: string; en: string; es: string } }> = [
  { key: 'wifi', icon: '📶', labels: { pt: 'Wi-Fi', en: 'Wi-Fi', es: 'Wi-Fi' } },
  { key: 'kitchen', icon: '🍳', labels: { pt: 'Cozinha equipada', en: 'Equipped kitchen', es: 'Cocina equipada' } },
  { key: 'parking', icon: '🅿️', labels: { pt: 'Estacionamento', en: 'Parking', es: 'Aparcamiento' } },
  { key: 'pool', icon: '🏊', labels: { pt: 'Piscina', en: 'Pool', es: 'Piscina' } },
  { key: 'fireplace', icon: '🔥', labels: { pt: 'Lareira', en: 'Fireplace', es: 'Chimenea' } },
  { key: 'bbq', icon: '🍖', labels: { pt: 'Churrasqueira', en: 'BBQ', es: 'Barbacoa' } },
  { key: 'washing_machine', icon: '🧺', labels: { pt: 'Máquina de lavar', en: 'Washing machine', es: 'Lavadora' } },
  { key: 'dishwasher', icon: '🍽️', labels: { pt: 'Máquina de loiça', en: 'Dishwasher', es: 'Lavavajillas' } },
  { key: 'tv', icon: '📺', labels: { pt: 'TV', en: 'TV', es: 'TV' } },
  { key: 'heating', icon: '🌡️', labels: { pt: 'Aquecimento', en: 'Heating', es: 'Calefacción' } },
  { key: 'air_conditioning', icon: '❄️', labels: { pt: 'Ar condicionado', en: 'Air conditioning', es: 'Aire acondicionado' } },
  { key: 'garden', icon: '🌳', labels: { pt: 'Jardim', en: 'Garden', es: 'Jardín' } },
  { key: 'pets_allowed', icon: '🐾', labels: { pt: 'Animais permitidos', en: 'Pets allowed', es: 'Mascotas permitidas' } },
  { key: 'family_friendly', icon: '👨‍👩‍👧', labels: { pt: 'Adequado a famílias', en: 'Family friendly', es: 'Apto para familias' } },
  { key: 'workspace', icon: '💻', labels: { pt: 'Espaço de trabalho', en: 'Workspace', es: 'Espacio de trabajo' } }
];

async function main() {
  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i]!;
    const existing = await db.select().from(amenities).where(eq(amenities.key, item.key)).limit(1);
    let amenityId: string;
    if (existing.length) {
      amenityId = existing[0]!.id;
      await db.update(amenities).set({ icon: item.icon, sortOrder: i }).where(eq(amenities.id, amenityId));
    } else {
      const [row] = await db
        .insert(amenities)
        .values({ key: item.key, icon: item.icon, sortOrder: i })
        .returning();
      amenityId = row!.id;
    }
    for (const [locale, label] of Object.entries(item.labels)) {
      await db
        .insert(amenityTranslations)
        .values({ amenityId, locale, label })
        .onConflictDoUpdate({
          target: [amenityTranslations.amenityId, amenityTranslations.locale],
          set: { label }
        });
    }
  }
  console.log(`Seeded ${CATALOG.length} amenities.`);
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
