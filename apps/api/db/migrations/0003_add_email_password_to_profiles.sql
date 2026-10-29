-- Migration: Add email and password_hash to profiles table
-- This migration adds email and password_hash fields for local auth (Round 1).

-- Add email column (required, unique)
ALTER TABLE `profiles` ADD COLUMN `email` text NOT NULL DEFAULT '';

-- Add password_hash column (required)
ALTER TABLE `profiles` ADD COLUMN `password_hash` text NOT NULL DEFAULT '';

-- Create unique index on email
CREATE UNIQUE INDEX `profiles_email_unique` ON `profiles` (`email`);
