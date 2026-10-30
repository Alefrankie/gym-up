CREATE TABLE `feedback_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'idea' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`author_id` text NOT NULL REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	`author_name` text NOT NULL,
	`created_at` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
