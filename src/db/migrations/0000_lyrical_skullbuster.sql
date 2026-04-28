CREATE TABLE `amenities` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `amenities_key_idx` ON `amenities` (`key`);--> statement-breakpoint
CREATE TABLE `amenity_translations` (
	`amenity_id` text NOT NULL,
	`locale` text NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`amenity_id`, `locale`),
	FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`user_id` text NOT NULL,
	`check_in` text NOT NULL,
	`check_out` text NOT NULL,
	`num_guests` integer DEFAULT 1 NOT NULL,
	`quoted_price` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`confirmation_code` text NOT NULL,
	`special_requests` text,
	`source` text DEFAULT 'direct' NOT NULL,
	`payment_status` text,
	`paid_amount` real,
	`paid_at` integer,
	`cancelled_at` integer,
	`cancelled_reason` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_confirmation_idx` ON `bookings` (`confirmation_code`);--> statement-breakpoint
CREATE INDEX `bookings_property_dates_idx` ON `bookings` (`property_id`,`check_in`,`check_out`);--> statement-breakpoint
CREATE INDEX `bookings_user_idx` ON `bookings` (`user_id`);--> statement-breakpoint
CREATE TABLE `competitor_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text NOT NULL,
	`scraped_at` integer NOT NULL,
	`status` text NOT NULL,
	`parsed_prices` text,
	`raw_html_ref` text,
	`error_message` text,
	FOREIGN KEY (`target_id`) REFERENCES `competitor_targets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competitor_snapshots_target_idx` ON `competitor_snapshots` (`target_id`,`scraped_at`);--> statement-breakpoint
CREATE TABLE `competitor_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`scrape_frequency` text DEFAULT 'daily' NOT NULL,
	`selector_strategy` text DEFAULT 'auto' NOT NULL,
	`selector_recipe` text,
	`last_scraped_at` integer,
	`last_status` text,
	`last_error` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competitor_targets_property_idx` ON `competitor_targets` (`property_id`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`country` text DEFAULT 'PT' NOT NULL,
	`region` text,
	`date` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_country_date_idx` ON `holidays` (`country`,`region`,`date`);--> statement-breakpoint
CREATE TABLE `ical_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`feed_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`source_uid` text NOT NULL,
	`summary` text,
	`synced_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`feed_id`) REFERENCES `ical_feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ical_blocks_unique_idx` ON `ical_blocks` (`feed_id`,`source_uid`);--> statement-breakpoint
CREATE INDEX `ical_blocks_dates_idx` ON `ical_blocks` (`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `ical_feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`last_synced_at` integer,
	`last_status` text,
	`last_error` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ical_feeds_property_idx` ON `ical_feeds` (`property_id`);--> statement-breakpoint
CREATE TABLE `price_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`date` text NOT NULL,
	`suggested_price` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`reasoning` text,
	`comparator_summary` text,
	`accepted_price` real,
	`accepted_by_user_id` text,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_suggestions_unique_idx` ON `price_suggestions` (`property_id`,`date`);--> statement-breakpoint
CREATE TABLE `pricing_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`nightly_rate` real NOT NULL,
	`weekend_rate` real,
	`min_stay` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pricing_periods_range_idx` ON `pricing_periods` (`property_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`city` text,
	`region` text,
	`country` text DEFAULT 'PT' NOT NULL,
	`lat` real,
	`lng` real,
	`max_guests` integer DEFAULT 2 NOT NULL,
	`bedrooms` integer DEFAULT 1 NOT NULL,
	`beds` integer DEFAULT 1 NOT NULL,
	`bathrooms` integer DEFAULT 1 NOT NULL,
	`base_price` real DEFAULT 80 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`check_in_time` text DEFAULT '15:00' NOT NULL,
	`check_out_time` text DEFAULT '11:00' NOT NULL,
	`cancellation_policy` text,
	`house_rules` text,
	`ical_export_token` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `properties_slug_idx` ON `properties` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `properties_ical_token_idx` ON `properties` (`ical_export_token`);--> statement-breakpoint
CREATE TABLE `property_amenities` (
	`property_id` text NOT NULL,
	`amenity_id` text NOT NULL,
	PRIMARY KEY(`property_id`, `amenity_id`),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `property_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`url` text NOT NULL,
	`alt_text` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `property_photos_property_idx` ON `property_photos` (`property_id`);--> statement-breakpoint
CREATE TABLE `property_translations` (
	`property_id` text NOT NULL,
	`locale` text NOT NULL,
	`tagline` text,
	`description` text,
	PRIMARY KEY(`property_id`, `locale`),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_tokens_hash_idx` ON `user_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `user_tokens_user_idx` ON `user_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`country` text,
	`discovery_channel` text,
	`locale` text DEFAULT 'pt' NOT NULL,
	`role` text DEFAULT 'guest' NOT NULL,
	`email_verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);