-- Coach personality and how the coach addresses the user (Spanish grammatical gender).
ALTER TABLE `profiles` ADD `coach_tone` text DEFAULT 'normal' NOT NULL;
ALTER TABLE `profiles` ADD `address_form` text DEFAULT 'neutral' NOT NULL;
