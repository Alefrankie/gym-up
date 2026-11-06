---
id: DR-0029
title: "Recipe book in the Comida section — shared recipes with likes and ratings, no comments"
status: accepted
tier: 2
date: 2026-11-06
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: "@alefrank"

scope: cross-team
reversibility: costly
risk_flags: [privacy, data, cost]

depends_on: [DR-0006, DR-0014, DR-0025, DR-0027, DR-0028]
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "packages/contracts/src/recipes.ts"
    - "apps/api/db/migrations/0026_recipes.sql"
    - "apps/api/db/schema.ts"
    - "apps/api/src/lib/contexts/recipes/"
    - "apps/api/src/nest/recipes/"
    - "apps/app/src/routes/nutrition/+page.svelte"
    - "apps/api/src/lib/contexts/nutrition/"
  issues: []
  prs: []

validation:
  criteria:
    - "Every signed-in member can read every published recipe; unauthenticated requests are rejected"
    - "Liking and rating are idempotent; an author cannot like or rate their own recipe; no comment endpoints exist"
    - "Ingredients store numeric quantities, so the client can scale a recipe by servings without parsing free text"
    - "A substitute is attached to one ingredient and never mutates the recipe's stored macros"
    - "Recipe photo bytes are served only to authenticated members, from a storage namespace of their own, with location/EXIF metadata stripped"
    - "A failed photo upload never blocks saving a recipe's text; a step photo is optional"
    - "'Añadir a hoy' creates a nutrition entry whose macros equal the recipe's per-serving macros times the servings eaten"
    - "A recipe that has been opened once is readable with the network off"
  review_by: null
  evidence: []
  validated_on: null

tags: [nutrition, social, content]
---

# DR-0029 · Recipe book in the Comida section

## Status and authorization

The product decision is the owner's and was taken on 2026-11-06: the recipe book ships **with likes and
ratings, and without comments**. The technical design below is the implementation proposal; no code, schema,
migration or deployment has been produced yet beyond the contract file at
`packages/contracts/src/recipes.ts`.

## Context

`/nutrition` is a calorie log: a meal photo goes through the Gemini adapter ([DR-0014](./DR-0014-ai-nutrition-analysis.md)),
comes back as kcal and macros, and is stored as an owner-only entry. It answers *"what have I eaten?"*. A recipe
book answers *"what do I cook?"*, and the product has no answer to that today.

Two things in the repository already shape this decision:

- **Likes are not new.** [DR-0028](./DR-0028-global-feed-and-member-profiles.md) put authenticated, idempotent
  likes on completed workouts, with no self-likes and no voter directory. Recipes reuse that model instead of
  inventing a second one.
- **`PRODUCT.md` does not forbid likes.** Its non-goals are a public social network, a follow graph and public
  profiles. Member-only likes and ratings on shared recipes stay inside that boundary, and DR-0028 already
  crossed it for workouts. Comments remain out. This record documents the boundary rather than moving it.

## Decision

### 1. Recipes are a sibling of the log, not a replacement

The `Comida` section gets two tabs: **Hoy** (today's calorie log, unchanged) and **Recetas** (new). Removing the
log would delete the only quantitative feedback loop the user has, and the two surfaces answer different
questions. The existing `/nutrition` routes, use cases and repository stay as they are.

### 2. Sharing scope

Every signed-in member can read every published recipe, like it and rate it. No follow graph, no public
profiles, no comments. Authors cannot like or rate their own recipe. Granular visibility (private recipes,
groups) is explicitly out of scope for this record.

### 3. Structured content, not prose

Ingredients, substitutes and steps are data, not text blobs:

| Entity | Shape | Why |
|---|---|---|
| Ingredient | `{ id, quantity: number\|null, unit, name, optional, substitutes[] }` | Numeric quantity lets the client scale by servings; `null` is "al gusto" |
| Substitute | `{ id, name, quantity?, unit?, note? }`, nested in its ingredient | "¿No tienes brócoli? → judías verdes" belongs to one ingredient, not to a paragraph |
| Step | `{ order, text, minutes?, photoId? }` | A step may carry a photo and its own duration |

Macros are **per serving** and nullable. Substituting an ingredient does **not** recompute them: the stored
figure is what the author estimated, and a note (`"cambia poco: ±20 kcal"`) carries the caveat. Silently
recalculating would present a guess as a measurement.

### 4. Photos

- The **cover photo is required to publish**; step photos are optional. Typing eight fields on a phone is the
  reason people do not publish; a photo plus corrections is.
- Recipe photos live in their own storage namespace (`recipes/`), separate from `progress_photos` (owner-only,
  [DR-0005](./DR-0005-private-photos.md)) and from `shared_workout_photos` ([DR-0028](./DR-0028-global-feed-and-member-profiles.md)).
  They are read by authenticated members only, never through a public object URL, and are stripped of location
  and EXIF metadata on upload.
- `PRODUCT.md` already accepts that cloud storage may answer 503. A photo failure must never block saving a
  recipe's text.

### 5. Offline

Reading is offline-first: a recipe opened once is cached with its images and readable with no signal, which is
the normal condition in a kitchen. Writing is online-only in this release — an offline recipe draft stays on
the device until the user publishes it. Full offline creation and sync are out of scope.

### 6. Creation, with AI as a draft

A photo of a dish produces a **draft** recipe (name, likely ingredients, steps) through the existing
`AIAnalysisPort`, reusing the provider decision in [DR-0014](./DR-0014-ai-nutrition-analysis.md). The draft is
always editable and never published automatically. Without an API key the flow falls back to the manual form;
a missing key degrades the feature, it does not block the section.

### 7. The link to the log

`Añadir a hoy` logs the recipe as a nutrition entry, scaling its per-serving macros by the servings eaten, and
returns the same shape the photo-based log returns. This is what keeps the recipe book part of the product
instead of a bookmark collection.

## Data model

New tables in a `0026_recipes.sql` migration, plus the Drizzle declarations in `apps/api/db/schema.ts`:

| Table | Key | Notes |
|---|---|---|
| `recipes` | `id` (client UUID, ADR-025) | `author_id`, `title`, `description`, `prep_minutes`, `cook_minutes`, `servings`, `cover_photo_id`, `tags` (JSON), `macros` (JSON), `created_at`, `updated_at` |
| `recipe_ingredients` | `id`, `recipe_id` | `position`, `quantity`, `unit`, `name`, `optional` |
| `recipe_substitutes` | `id`, `ingredient_id` | `name`, `quantity`, `unit`, `note` |
| `recipe_steps` | `id`, `recipe_id` | `position`, `text`, `minutes` |
| `recipe_photos` | `id`, `recipe_id` | `step_order` (null = cover), `storage_key`, `content_type`, `bytes`, `created_at` |
| `recipe_likes` | `(recipe_id, user_id)` | composite key, mirrors `workout_likes` |
| `recipe_ratings` | `(recipe_id, user_id)` | `rating` 1–5, `created_at`, `updated_at`; one per member, updatable |

`rating_count` and `rating_average` are read aggregates, never stored on the recipe row.

## Alternatives and rationale

- **Replacing the log with the recipe book** was rejected: it trades a feedback loop the user already has for
  one they do not.
- **Free-text ingredients and steps** would have been far cheaper, but then servings cannot be scaled, "≤15 min
  + pollo" cannot be filtered, and substitutes become decoration.
- **One generic `likes` table shared with workouts** would couple two contexts through a polymorphic key. Two
  narrow tables and one shared contract shape keep the same behaviour with less coupling.
- **Stars without an average, or five separate tag tables**, were rejected as either unusable for sorting or
  over-modelled for a few dozen recipes.
- **Mandatory step photos** were rejected on friction: it is the most expensive part of authoring and the least
  read part of a recipe.

## Consequences

- The intent document stops describing nutrition as a log only. Adding a recipe line to `PRODUCT.md`'s Outcome
  is an owner edit and is **not** done by this record.
- `Añadir a hoy` makes the `recipes` context call into `nutrition`. The dependency direction is one way:
  `nutrition` must not learn about recipes.
- Ratings introduce an aggregate every member can see; it is not personal data, but it is member behaviour.
  No per-user rating breakdown is ever returned.
- A recipe with no cover photo stays a draft and is invisible in the list.
- Storage: one cover per recipe plus optional step photos is a materially larger volume than one photo per
  workout. This is the cost to watch in [DR-0014](./DR-0014-ai-nutrition-analysis.md)'s free-tier assumption.

## Evidence

Inspected while writing this record: `apps/app/src/routes/nutrition/+page.svelte`,
`apps/api/src/lib/contexts/nutrition/`, `apps/api/db/schema.ts` (nutrition and community tables),
`apps/api/db/migrations/0024_community.sql`, `packages/contracts/src/{nutrition,community,photos}.ts`,
`apps/app/src/lib/i18n/index.svelte.ts`, `apps/app/src/lib/components/AppNav.svelte`, `PRODUCT.md`.
Contract written: `packages/contracts/src/recipes.ts` (`pnpm --filter @gym-up/contracts typecheck` passes).
Backend written and tested: `apps/api/db/migrations/0026_recipes.sql`, the seven recipe tables in
`apps/api/db/schema.ts`, `apps/api/src/lib/contexts/recipes/` and `apps/api/src/nest/recipes/`, covered by
`apps/api/tests/nest/recipes.e2e.test.ts` (9/9 passing; `pnpm --filter @gym-up/api test` 361/361).
"Añadir a hoy" is wired through a caller-owned port (`recipes/domain/ports/meal-log.port.ts`) and an adapter
over nutrition's `LogMealUseCase`, so `nutrition` still knows nothing about recipes.
No screen and no deployment yet.

## Log

- 2026-11-06 accepted after the owner approved the direction and chose likes and ratings, with comments
  explicitly deferred ("Comentarios aún no"). Technical design is the proposal in this record.
- 2026-11-06 backend built: migration 0026, schema tables, and the `recipes` context with list, detail,
  create, edit, like, rate and photo upload/read. Comment endpoints do not exist. Not deployed; the UI is
  untouched.
- 2026-11-06 "Añadir a hoy" wired: `POST /recipes/:id/log` scales the per-serving macros by the servings
  eaten and reuses nutrition's `LogMealUseCase` through a port the `recipes` context owns, so the dependency
  stays one way. A recipe with no estimated macros is refused (409) instead of logging a meal of zeros.
