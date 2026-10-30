-- The Coach's lines recorded by an admin in the voice studio (small Opus clips stored inline).
CREATE TABLE `coach_recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`tone` text NOT NULL,
	`locale` text NOT NULL,
	`event` text NOT NULL,
	`form` text,
	`text` text NOT NULL,
	`content_type` text NOT NULL,
	`audio` blob NOT NULL,
	`bytes` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE INDEX `coach_recordings_tone` ON `coach_recordings` (`tone`, `locale`);
