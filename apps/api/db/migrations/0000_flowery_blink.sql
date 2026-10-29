CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`routine_type` text NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
