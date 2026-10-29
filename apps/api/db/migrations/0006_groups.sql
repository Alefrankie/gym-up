-- Groups (replace the all-visible Family view): a group has an invite code; members see each other only inside it.
CREATE TABLE `groups` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `code` text NOT NULL,
  `owner_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX `groups_code_unique` ON `groups` (`code`);

CREATE TABLE `group_members` (
  `group_id` text NOT NULL REFERENCES `groups`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `joined_at` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`group_id`, `user_id`)
);
CREATE INDEX `group_members_user_idx` ON `group_members` (`user_id`);
