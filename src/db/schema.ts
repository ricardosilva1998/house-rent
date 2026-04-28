import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
  index
} from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

const id = (name = 'id') =>
  text(name).primaryKey().$defaultFn(() => createId());

const ts = (name: string) =>
  integer(name, { mode: 'timestamp_ms' });

// =============================================================================
// AUTH
// =============================================================================

export const users = sqliteTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    country: text('country'),
    discoveryChannel: text('discovery_channel'),
    locale: text('locale').notNull().default('pt'),
    role: text('role', { enum: ['guest', 'admin'] }).notNull().default('guest'),
    emailVerifiedAt: ts('email_verified_at'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: ts('updated_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)]
);

export const userTokens = sqliteTable(
  'user_tokens',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['verify_email', 'reset_password', 'admin_invite'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [
    uniqueIndex('user_tokens_hash_idx').on(t.tokenHash),
    index('user_tokens_user_idx').on(t.userId)
  ]
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [
    uniqueIndex('sessions_token_idx').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId)
  ]
);

// =============================================================================
// PROPERTY (multi-property capable; v1 UI shows one)
// =============================================================================

export const properties = sqliteTable(
  'properties',
  {
    id: id(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    address: text('address'),
    city: text('city'),
    region: text('region'),
    country: text('country').notNull().default('PT'),
    lat: real('lat'),
    lng: real('lng'),
    maxGuests: integer('max_guests').notNull().default(2),
    bedrooms: integer('bedrooms').notNull().default(1),
    beds: integer('beds').notNull().default(1),
    bathrooms: integer('bathrooms').notNull().default(1),
    basePrice: real('base_price').notNull().default(80),
    currency: text('currency').notNull().default('EUR'),
    checkInTime: text('check_in_time').notNull().default('15:00'),
    checkOutTime: text('check_out_time').notNull().default('11:00'),
    cancellationPolicy: text('cancellation_policy'),
    houseRules: text('house_rules'),
    icalExportToken: text('ical_export_token').notNull().$defaultFn(() => createId()),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: ts('updated_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [
    uniqueIndex('properties_slug_idx').on(t.slug),
    uniqueIndex('properties_ical_token_idx').on(t.icalExportToken)
  ]
);

export const propertyTranslations = sqliteTable(
  'property_translations',
  {
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    tagline: text('tagline'),
    description: text('description')
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.locale] })]
);

export const propertyPhotos = sqliteTable(
  'property_photos',
  {
    id: id(),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    altText: text('alt_text'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [index('property_photos_property_idx').on(t.propertyId)]
);

export const amenities = sqliteTable(
  'amenities',
  {
    id: id(),
    key: text('key').notNull(),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0)
  },
  (t) => [uniqueIndex('amenities_key_idx').on(t.key)]
);

export const amenityTranslations = sqliteTable(
  'amenity_translations',
  {
    amenityId: text('amenity_id').notNull().references(() => amenities.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    label: text('label').notNull()
  },
  (t) => [primaryKey({ columns: [t.amenityId, t.locale] })]
);

export const propertyAmenities = sqliteTable(
  'property_amenities',
  {
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    amenityId: text('amenity_id').notNull().references(() => amenities.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.amenityId] })]
);

// =============================================================================
// PRICING
// =============================================================================

export const pricingPeriods = sqliteTable(
  'pricing_periods',
  {
    id: id(),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    nightlyRate: real('nightly_rate').notNull(),
    weekendRate: real('weekend_rate'),
    minStay: integer('min_stay').notNull().default(1),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [index('pricing_periods_range_idx').on(t.propertyId, t.startDate, t.endDate)]
);

export const priceSuggestions = sqliteTable(
  'price_suggestions',
  {
    id: id(),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    suggestedPrice: real('suggested_price').notNull(),
    currency: text('currency').notNull().default('EUR'),
    reasoning: text('reasoning'),
    comparatorSummary: text('comparator_summary'),
    acceptedPrice: real('accepted_price'),
    acceptedByUserId: text('accepted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: ts('accepted_at'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [uniqueIndex('price_suggestions_unique_idx').on(t.propertyId, t.date)]
);

export const competitorTargets = sqliteTable(
  'competitor_targets',
  {
    id: id(),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    label: text('label'),
    scrapeFrequency: text('scrape_frequency', { enum: ['daily', 'weekly'] }).notNull().default('daily'),
    selectorStrategy: text('selector_strategy', { enum: ['auto', 'manual'] }).notNull().default('auto'),
    selectorRecipe: text('selector_recipe'),
    lastScrapedAt: ts('last_scraped_at'),
    lastStatus: text('last_status'),
    lastError: text('last_error'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [index('competitor_targets_property_idx').on(t.propertyId)]
);

export const competitorSnapshots = sqliteTable(
  'competitor_snapshots',
  {
    id: id(),
    targetId: text('target_id').notNull().references(() => competitorTargets.id, { onDelete: 'cascade' }),
    scrapedAt: ts('scraped_at').notNull().$defaultFn(() => new Date()),
    status: text('status', { enum: ['ok', 'error'] }).notNull(),
    parsedPrices: text('parsed_prices'),
    rawHtmlRef: text('raw_html_ref'),
    errorMessage: text('error_message')
  },
  (t) => [index('competitor_snapshots_target_idx').on(t.targetId, t.scrapedAt)]
);

// =============================================================================
// BOOKINGS
// =============================================================================

export const bookings = sqliteTable(
  'bookings',
  {
    id: id(),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    checkIn: text('check_in').notNull(),
    checkOut: text('check_out').notNull(),
    numGuests: integer('num_guests').notNull().default(1),
    quotedPrice: real('quoted_price').notNull(),
    currency: text('currency').notNull().default('EUR'),
    status: text('status', { enum: ['confirmed', 'cancelled', 'completed', 'no_show'] }).notNull().default('confirmed'),
    confirmationCode: text('confirmation_code').notNull(),
    specialRequests: text('special_requests'),
    source: text('source').notNull().default('direct'),
    paymentStatus: text('payment_status', { enum: ['unpaid', 'partial', 'paid', 'refunded'] }),
    paidAmount: real('paid_amount'),
    paidAt: ts('paid_at'),
    cancelledAt: ts('cancelled_at'),
    cancelledReason: text('cancelled_reason'),
    completedAt: ts('completed_at'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: ts('updated_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [
    uniqueIndex('bookings_confirmation_idx').on(t.confirmationCode),
    index('bookings_property_dates_idx').on(t.propertyId, t.checkIn, t.checkOut),
    index('bookings_user_idx').on(t.userId)
  ]
);

// =============================================================================
// iCal SYNC
// =============================================================================

export const icalFeeds = sqliteTable(
  'ical_feeds',
  {
    id: id(),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    lastSyncedAt: ts('last_synced_at'),
    lastStatus: text('last_status'),
    lastError: text('last_error'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [index('ical_feeds_property_idx').on(t.propertyId)]
);

export const icalBlocks = sqliteTable(
  'ical_blocks',
  {
    id: id(),
    feedId: text('feed_id').notNull().references(() => icalFeeds.id, { onDelete: 'cascade' }),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    sourceUid: text('source_uid').notNull(),
    summary: text('summary'),
    syncedAt: ts('synced_at').notNull().$defaultFn(() => new Date()),
    deletedAt: ts('deleted_at')
  },
  (t) => [
    uniqueIndex('ical_blocks_unique_idx').on(t.feedId, t.sourceUid),
    index('ical_blocks_dates_idx').on(t.startDate, t.endDate)
  ]
);

// =============================================================================
// MISC
// =============================================================================

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    metadata: text('metadata'),
    createdAt: ts('created_at').notNull().$defaultFn(() => new Date())
  },
  (t) => [index('audit_log_actor_idx').on(t.actorUserId, t.createdAt)]
);

export const holidays = sqliteTable(
  'holidays',
  {
    id: id(),
    country: text('country').notNull().default('PT'),
    region: text('region'),
    date: text('date').notNull(),
    name: text('name').notNull()
  },
  (t) => [uniqueIndex('holidays_country_date_idx').on(t.country, t.region, t.date)]
);

export const settings = sqliteTable(
  'settings',
  {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: ts('updated_at').notNull().$defaultFn(() => new Date())
  }
);

// Re-export common types for ergonomic imports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type Session = typeof sessions.$inferSelect;
