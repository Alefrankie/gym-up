-- Training-style collections (Calisthenics for now) as a JSON array on each exercise, kept apart from
-- `equipment`: a pull-up belongs to the collection and still requires a bar.
ALTER TABLE `exercises` ADD `styles` text DEFAULT '[]' NOT NULL;
