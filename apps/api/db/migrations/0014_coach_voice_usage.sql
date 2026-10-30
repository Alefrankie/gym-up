-- Characters sent to the Coach cloud voice per UTC day, to stay inside Workers AI's free daily allocation.
CREATE TABLE `coach_voice_usage` (
	`day` text PRIMARY KEY NOT NULL,
	`chars` integer DEFAULT 0 NOT NULL
);
