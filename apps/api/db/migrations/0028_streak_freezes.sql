-- A frozen day keeps the streak alive without a workout (DR-0032). `day` is a UTC YYYY-MM-DD key.
CREATE TABLE `streak_freezes` (
  `user_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `day` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`, `day`)
);
