-- Voice studio for several people: who may record (granted by the admin), one take per person per line, likes and
-- comments, and the admin's pick of the take the app plays (the active take).

CREATE TABLE `studio_members` (
	`user_id` text PRIMARY KEY NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	`granted_by` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `studio_takes` (
	`id` text PRIMARY KEY NOT NULL,
	`line_id` text NOT NULL,
	`author_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	`tone` text NOT NULL,
	`locale` text NOT NULL,
	`event` text NOT NULL,
	`form` text,
	`text` text NOT NULL,
	`content_type` text NOT NULL,
	`audio` blob NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `studio_takes_line_author` ON `studio_takes` (`line_id`, `author_id`);
CREATE INDEX `studio_takes_author` ON `studio_takes` (`author_id`);

CREATE TABLE `studio_active` (
	`line_id` text PRIMARY KEY NOT NULL,
	`take_id` text NOT NULL REFERENCES `studio_takes`(`id`) ON DELETE CASCADE,
	`chosen_by` text NOT NULL,
	`chosen_at` integer NOT NULL
);

CREATE TABLE `studio_votes` (
	`take_id` text NOT NULL REFERENCES `studio_takes`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	`created_at` integer NOT NULL,
	PRIMARY KEY (`take_id`, `user_id`)
);

CREATE TABLE `studio_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`line_id` text NOT NULL,
	`take_id` text REFERENCES `studio_takes`(`id`) ON DELETE SET NULL,
	`author_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
CREATE INDEX `studio_comments_line` ON `studio_comments` (`line_id`);

-- Writes and uploaded bytes per person per UTC day, to stay inside D1's free tier.
CREATE TABLE `studio_usage` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`writes` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY (`user_id`, `day`)
);

-- The recordings made so far were the admin's: they become the admin's takes and stay the active ones.
INSERT INTO `studio_takes` (`id`, `line_id`, `author_id`, `tone`, `locale`, `event`, `form`, `text`, `content_type`, `audio`, `bytes`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), r.`id`, p.`id`, r.`tone`, r.`locale`, r.`event`, r.`form`, r.`text`, r.`content_type`, r.`audio`, r.`bytes`, r.`updated_at`, r.`updated_at`
FROM `coach_recordings` r JOIN `profiles` p ON lower(p.`email`) = 'alefrank.m@gmail.com';
INSERT INTO `studio_active` (`line_id`, `take_id`, `chosen_by`, `chosen_at`)
SELECT `line_id`, `id`, `author_id`, `updated_at` FROM `studio_takes`;
-- `coach_recordings` is no longer read; it is dropped in a later migration once no deployed code uses it.
