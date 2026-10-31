-- The `hard` Coach tone is gone: tones are normal, flower and gymrat. Its users move to normal (there were none) and
-- studio content recorded for its lines goes with it (there was none).
UPDATE `profiles` SET `coach_tone` = 'normal' WHERE `coach_tone` NOT IN ('normal', 'flower', 'gymrat');
DELETE FROM `studio_active` WHERE `take_id` IN (SELECT `id` FROM `studio_takes` WHERE `tone` = 'hard');
DELETE FROM `studio_votes` WHERE `take_id` IN (SELECT `id` FROM `studio_takes` WHERE `tone` = 'hard');
DELETE FROM `studio_comments` WHERE `line_id` IN (SELECT `line_id` FROM `studio_takes` WHERE `tone` = 'hard');
DELETE FROM `studio_takes` WHERE `tone` = 'hard';
