-- Community (DR-0028): one like per member per workout, and at most one photo a member chose to share on a
-- workout. Shared photos are their own resource: private progress photos are never converted or exposed.
CREATE TABLE `workout_likes` (
  `workout_id` text NOT NULL REFERENCES `workouts`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`workout_id`, `user_id`)
);

CREATE TABLE `shared_workout_photos` (
  `workout_id` text PRIMARY KEY NOT NULL REFERENCES `workouts`(`id`) ON DELETE CASCADE,
  `owner_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `storage_key` text NOT NULL,
  `content_type` text NOT NULL,
  `bytes` integer NOT NULL,
  `created_at` integer NOT NULL DEFAULT 0
);

-- Feed and member history read completed workouts newest first with an id tie-break.
CREATE INDEX `workouts_status_date_idx` ON `workouts` (`status`, `workout_date`, `id`);
CREATE INDEX `workouts_user_status_date_idx` ON `workouts` (`user_id`, `status`, `workout_date`, `id`);
