import { db } from '../db/client';
import { properties, propertyTranslations, propertyPhotos, propertyAmenities, amenities, amenityTranslations } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

export async function getDefaultProperty() {
  const rows = await db.select().from(properties).orderBy(asc(properties.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function getPropertyTranslations(propertyId: string) {
  return db.select().from(propertyTranslations).where(eq(propertyTranslations.propertyId, propertyId));
}

export async function getPropertyPhotos(propertyId: string) {
  return db
    .select()
    .from(propertyPhotos)
    .where(eq(propertyPhotos.propertyId, propertyId))
    .orderBy(asc(propertyPhotos.sortOrder), asc(propertyPhotos.createdAt));
}

export async function getAllAmenities(locale: string = 'pt') {
  const rows = await db
    .select({
      id: amenities.id,
      key: amenities.key,
      icon: amenities.icon,
      sortOrder: amenities.sortOrder,
      label: amenityTranslations.label
    })
    .from(amenities)
    .leftJoin(amenityTranslations, eq(amenityTranslations.amenityId, amenities.id))
    .orderBy(asc(amenities.sortOrder));
  const grouped = new Map<string, { id: string; key: string; icon: string | null; sortOrder: number; labels: Record<string, string> }>();
  for (const r of rows) {
    if (!grouped.has(r.id)) {
      grouped.set(r.id, { id: r.id, key: r.key, icon: r.icon, sortOrder: r.sortOrder, labels: {} });
    }
    if (r.label) {
      const entry = grouped.get(r.id)!;
      // We need locale per row - rerun a separate query for translations by amenityId
    }
  }
  // Simpler: re-query translations
  const trans = await db.select().from(amenityTranslations);
  const labelMap = new Map<string, Record<string, string>>();
  for (const t of trans) {
    if (!labelMap.has(t.amenityId)) labelMap.set(t.amenityId, {});
    labelMap.get(t.amenityId)![t.locale] = t.label;
  }
  return Array.from(grouped.values()).map((a) => ({
    ...a,
    labels: labelMap.get(a.id) ?? {},
    label: labelMap.get(a.id)?.[locale] ?? labelMap.get(a.id)?.['pt'] ?? a.key
  }));
}

export async function getPropertyAmenityIds(propertyId: string) {
  const rows = await db
    .select({ amenityId: propertyAmenities.amenityId })
    .from(propertyAmenities)
    .where(eq(propertyAmenities.propertyId, propertyId));
  return new Set(rows.map((r) => r.amenityId));
}
