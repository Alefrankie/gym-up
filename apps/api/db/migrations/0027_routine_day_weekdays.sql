-- A routine may be planned on multiple weekdays. Backfill the prior one-day value without changing
-- the legacy column, which remains available to older clients during the compatibility period.
CREATE TABLE `routine_day_weekdays` (
  `routine_day_id` text NOT NULL REFERENCES `routine_days`(`id`) ON DELETE CASCADE,
  `weekday` integer NOT NULL CHECK (`weekday` BETWEEN 0 AND 6),
  PRIMARY KEY (`routine_day_id`, `weekday`)
);

CREATE INDEX `routine_day_weekdays_weekday_idx` ON `routine_day_weekdays` (`weekday`);

INSERT INTO `routine_day_weekdays` (`routine_day_id`, `weekday`)
SELECT `id`, `weekday` FROM `routine_days` WHERE `weekday` BETWEEN 0 AND 6;
