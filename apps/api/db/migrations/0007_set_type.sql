-- Kind of set: a normal working set, a warm-up, a drop set or a set taken to failure.
ALTER TABLE `workout_entries` ADD `set_type` text DEFAULT 'normal' NOT NULL;
