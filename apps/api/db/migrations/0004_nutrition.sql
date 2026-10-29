-- Migration: Add nutrition_entries and nutrition_goals tables
-- Story 5.3 — Nutrition History + Daily Summary

CREATE TABLE `nutrition_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`storage_path` text NOT NULL,
	`photo_date` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`total_calories` integer DEFAULT 0 NOT NULL,
	`total_protein` integer DEFAULT 0 NOT NULL,
	`total_carbs` integer DEFAULT 0 NOT NULL,
	`total_fat` integer DEFAULT 0 NOT NULL,
	`food_items` text NOT NULL,
	`ai_raw_response` text,
	`user_edited` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nutrition_entries_user_id_idx` ON `nutrition_entries` (`user_id`);
--> statement-breakpoint
CREATE INDEX `nutrition_entries_created_at_idx` ON `nutrition_entries` (`created_at`);
--> statement-breakpoint
CREATE TABLE `nutrition_goals` (
	`user_id` text PRIMARY KEY NOT NULL,
	`daily_calorie_goal` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
