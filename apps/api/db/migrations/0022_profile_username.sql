ALTER TABLE `profiles` ADD `username` text;
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);
