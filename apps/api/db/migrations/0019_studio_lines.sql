-- Voice studio: lines added by people (custom lines, the admin approves the ones collaborators propose), edits of any
-- line's text (an override of a built-in line, or the custom line's own text) and the history of those changes.

-- One row per address-form variant; `group_id` ties the variants of one line together.
CREATE TABLE `studio_custom_lines` (
	`line_id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`form` text,
	`tone` text NOT NULL,
	`locale` text NOT NULL,
	`event` text NOT NULL,
	`text` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`author_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE INDEX `studio_custom_lines_group` ON `studio_custom_lines` (`group_id`);

-- New text for a built-in line, keyed by the line's id (the hash of its original rendering).
CREATE TABLE `studio_overrides` (
	`line_id` text PRIMARY KEY NOT NULL,
	`original_text` text NOT NULL,
	`text` text NOT NULL,
	`tone` text NOT NULL,
	`locale` text NOT NULL,
	`event` text NOT NULL,
	`form` text,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE `studio_line_history` (
	`id` text PRIMARY KEY NOT NULL,
	`line_id` text NOT NULL,
	`kind` text NOT NULL,
	`previous_text` text,
	`new_text` text,
	`author_id` text NOT NULL,
	`created_at` integer NOT NULL
);
CREATE INDEX `studio_line_history_line` ON `studio_line_history` (`line_id`);
