ALTER TABLE `profiles` ADD `last_access_at` integer;

-- Seed the best activity date still available. Logout deletes its session row,
-- so older users may legitimately remain NULL until their next app request.
UPDATE `profiles`
SET `last_access_at` = (
  SELECT MAX(`created_at`)
  FROM `sessions`
  WHERE `sessions`.`user_id` = `profiles`.`id`
)
WHERE EXISTS (
  SELECT 1
  FROM `sessions`
  WHERE `sessions`.`user_id` = `profiles`.`id`
);
