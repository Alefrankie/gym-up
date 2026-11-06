-- Recipes (DR-0029): shared recipes with structured ingredients, substitutes and steps.
--
-- Sharing scope mirrors DR-0028: every signed-in member reads, likes and rates every published recipe.
-- Comments are deliberately absent. A recipe with no cover photo is a draft and is listed only to its author.
--
-- Macros are per serving and nullable: substituting an ingredient never recomputes them, because a guess
-- presented as a measurement is worse than an honest null.

CREATE TABLE `recipes` (
  `id` text PRIMARY KEY NOT NULL,
  `author_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `description` text,
  -- Hands-on work before cooking, and time on the heat. Null when the author does not want to commit.
  `prep_minutes` integer,
  `cook_minutes` integer,
  `servings` integer NOT NULL DEFAULT 2,
  -- JSON array of RecipeTag values.
  `tags` text NOT NULL DEFAULT '[]',
  -- JSON { calories, protein, carbs, fat } for ONE serving. Null = not estimated.
  `macros` text,
  `created_at` integer NOT NULL DEFAULT 0,
  `updated_at` integer NOT NULL DEFAULT 0
);

CREATE TABLE `recipe_ingredients` (
  `id` text PRIMARY KEY NOT NULL,
  `recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  `position` integer NOT NULL,
  -- Numeric so the client can scale by servings; null means "al gusto".
  `quantity` real,
  `unit` text,
  `name` text NOT NULL,
  `optional` integer NOT NULL DEFAULT 0
);

-- An alternative for ONE ingredient ("no quinoa → arroz integral"). Nested by design: it belongs to the
-- ingredient it replaces, not to a free-text paragraph.
CREATE TABLE `recipe_substitutes` (
  `id` text PRIMARY KEY NOT NULL,
  `ingredient_id` text NOT NULL REFERENCES `recipe_ingredients`(`id`) ON DELETE CASCADE,
  `position` integer NOT NULL,
  `name` text NOT NULL,
  `quantity` real,
  `unit` text,
  `note` text
);

CREATE TABLE `recipe_steps` (
  `recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  `position` integer NOT NULL,
  `text` text NOT NULL,
  `minutes` integer,
  PRIMARY KEY (`recipe_id`, `position`)
);

-- Cover (`step_order` null) and per-step photos. Their own storage namespace: progress photos stay
-- owner-only (ADR-005) and shared workout photos are a different resource (DR-0028).
CREATE TABLE `recipe_photos` (
  `id` text PRIMARY KEY NOT NULL,
  `recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  `step_order` integer,
  `storage_key` text NOT NULL,
  `content_type` text NOT NULL,
  `bytes` integer NOT NULL,
  `created_at` integer NOT NULL DEFAULT 0
);

CREATE TABLE `recipe_likes` (
  `recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`recipe_id`, `user_id`)
);

CREATE TABLE `recipe_ratings` (
  `recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `profiles`(`id`) ON DELETE CASCADE,
  `rating` integer NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
  `created_at` integer NOT NULL DEFAULT 0,
  `updated_at` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`recipe_id`, `user_id`)
);

-- Listing reads newest first with an id tie-break, and by author for a member's own recipes.
CREATE INDEX `recipes_created_idx` ON `recipes` (`created_at`, `id`);
CREATE INDEX `recipes_author_created_idx` ON `recipes` (`author_id`, `created_at`, `id`);
CREATE INDEX `recipe_ingredients_recipe_idx` ON `recipe_ingredients` (`recipe_id`, `position`);
CREATE INDEX `recipe_substitutes_ingredient_idx` ON `recipe_substitutes` (`ingredient_id`, `position`);

-- One cover per recipe, one photo per step. SQLite treats NULLs as distinct in a unique index, so the
-- cover needs its own partial index or a recipe could collect any number of them.
CREATE UNIQUE INDEX `recipe_photos_cover_idx` ON `recipe_photos` (`recipe_id`) WHERE `step_order` IS NULL;
CREATE UNIQUE INDEX `recipe_photos_step_idx` ON `recipe_photos` (`recipe_id`, `step_order`) WHERE `step_order` IS NOT NULL;
