-- Planned day of the week of each routine (0 = Sunday … 6 = Saturday); null keeps the rotation.
ALTER TABLE `routine_days` ADD `weekday` integer;
