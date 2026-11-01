-- Body weight captured when a bodyweight set was logged, in kg. `weight` keeps meaning external
-- load (added weight), so existing rows are left untouched: no backfill, they stay NULL.
ALTER TABLE `workout_entries` ADD `body_weight_kg_at_set` real;
