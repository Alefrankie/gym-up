-- Daily supplement checklist: a user's supplements and the days each one was taken.
CREATE TABLE `supplements` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `sort_order` integer NOT NULL DEFAULT 0,
  `archived` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT 0
);
CREATE INDEX `supplements_user_idx` ON `supplements` (`user_id`);

CREATE TABLE `supplement_logs` (
  `supplement_id` text NOT NULL REFERENCES `supplements`(`id`) ON DELETE CASCADE,
  `day` text NOT NULL,
  `taken_at` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`supplement_id`, `day`)
);
