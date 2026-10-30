-- The Coach addresses users as a man or as a woman only ("Sin género" is gone).
-- Users who picked a form keep it and are marked as having chosen; the rest move to 'm' and Home asks them once.
ALTER TABLE `profiles` ADD `address_form_chosen` integer DEFAULT 0 NOT NULL;
UPDATE `profiles` SET `address_form_chosen` = 1 WHERE `address_form` IN ('m', 'f');
UPDATE `profiles` SET `address_form` = 'm' WHERE `address_form` NOT IN ('m', 'f');
DELETE FROM `coach_recordings` WHERE `form` NOT IN ('m', 'f');
