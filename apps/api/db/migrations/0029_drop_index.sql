-- Weight drops inside one drop set (DR-0033): 0 is the set itself, 1, 2, 3… each drop after it.
-- Rows written before this column exist keep 0, so every old set stays a set of its own.
ALTER TABLE `workout_entries` ADD `drop_index` integer DEFAULT 0 NOT NULL;
