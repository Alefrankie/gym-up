-- Soft delete: a deleted profile keeps its rows but cannot sign in and never shows in Community.
ALTER TABLE `profiles` ADD `deleted_at` integer;
