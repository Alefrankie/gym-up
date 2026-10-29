---
id: ADR-017
title: Exercise Catalog — System Library + Custom User Exercises
type: decision
status: accepted
date: 2026-10-01
---

# ADR-017: Exercise Catalog — System Library + Custom User Exercises

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted. Resolves [OQ-002](../../planning/open-questions.md) (instructions/videos).

## Context

Phase 1 has 32 seeded exercises with `name` and a free-text `muscle_group` (`chest`, `back`, `legs`, `core`, …). Hevy ships a library of hundreds of exercises, each with an equipment type, primary and secondary muscles, an exercise type (reps, duration, distance …) and instructions, and lets users create custom exercises. Progression ([ADR-021](./021-progression-engine.md)) needs the equipment to choose weight increments. Statistics need normalized muscles for the muscle distribution chart.

## Decision

### 1. One table, two owners

`exercises` holds both catalogs:

- **System exercises:** `owner_id IS NULL`. Seeded, read-all, never editable by clients.
- **Custom exercises:** `owner_id = profiles.id`. Created by a user and visible to **all family members** (read-all, like workouts, per [ADR-004](./004-rls-visibility.md)), because a sibling's feed shows the exercise names. Only the owner can edit or archive them. A sibling may not *add* another user's custom exercise to their own routines (the picker filters `owner_id IS NULL OR owner_id = me`).

Uniqueness: `UNIQUE(owner_id, name)`, with system names unique among system rows. In Postgres this is `UNIQUE NULLS NOT DISTINCT`; in SQLite, a partial index for `owner_id IS NULL` plus a composite index.

### 2. New columns

| Column | Type | Values |
|---|---|---|
| `muscle_group` | TEXT (kept; now means **primary muscle**) | `MuscleGroups` enum below |
| `secondary_muscles` | TEXT (JSON array) | subset of `MuscleGroups` |
| `equipment` | TEXT | `barbell`, `dumbbell`, `machine`, `cable`, `kettlebell`, `bodyweight`, `band`, `plate`, `smith_machine`, `other` |
| `exercise_type` | TEXT | `weight_reps`, `bodyweight_reps`, `weighted_bodyweight`, `assisted_bodyweight`, `duration`, `distance_duration`, `weight_distance` (semantics in [ADR-016](./016-workout-data-model-v2.md)) |
| `instructions` | TEXT NULL | Markdown, 2–6 numbered steps |
| `video_url` | TEXT NULL | External link only (YouTube etc.). No video hosting |
| `owner_id` | UUID NULL | NULL = system |
| `is_archived` | BOOLEAN | Archived custom exercises disappear from pickers but stay in history |
| `created_at` | TIMESTAMP | |

`MuscleGroups` (Hevy taxonomy): `abdominals`, `abductors`, `adductors`, `biceps`, `calves`, `cardio`, `chest`, `forearms`, `full_body`, `glutes`, `hamstrings`, `lats`, `lower_back`, `neck`, `quadriceps`, `shoulders`, `traps`, `triceps`, `upper_back`, `other`.

### 3. Legacy mapping (Phase 1 → Phase 2)

| Phase 1 `muscle_group` | Phase 2 |
|---|---|
| `chest` | `chest` |
| `shoulders` | `shoulders` |
| `triceps` | `triceps` |
| `biceps` | `biceps` |
| `back` | `lats` for pulldowns and pullovers, `upper_back` for rows |
| `core` | `abdominals` |
| `quads` | `quadriceps` |
| `hamstrings` | `hamstrings` |
| `glutes` | `glutes` |
| `legs` | `adductors` (Adductors), `abductors` (Abductors), `calves` (Calves), `quadriceps` (Lunges) |

The full per-exercise mapping with equipment and type lives in [database-schema.md → Exercise Library Seed](../database-schema.md#exercise-library-seed).

### 4. Instructions and video

Answer to OQ-002, following Hevy: **yes, text instructions for every system exercise, plus an optional external video link**. No hosted media, because of Supabase free-tier storage.

### 5. Deletion

Exercises are never hard-deleted while sets reference them. Custom exercises are archived. System exercises are immutable.

## Rationale

- One table keeps every FK (`workout_entries.exercise_id`, `routine_exercises.exercise_id`) unchanged.
- `equipment` and `exercise_type` are the minimum metadata needed by the progression engine, the live workout inputs and the stats.

## Trade-offs

- **Pro:** No new FK targets. Phase 1 queries are untouched.
- **Con:** Custom exercises are visible to the whole family. That is acceptable under the family model ([ADR-004](./004-rls-visibility.md)).
- **Con:** Muscle mapping of legacy rows is a judgment call, so it is documented and fixed in the seed.

## Consequences

- New context `exercise-library` ([context](../contexts/exercise-library/readme.md), [PRD](../../prd/features/exercise-library.md)).
- `workout-tracking` reads exercises through an `ExerciseCatalogPort` implemented by the exercise-library context.
- RLS: `exercises_select_read_all`, plus `exercises_insert_own` / `exercises_update_own` with `owner_id = auth.uid()`. No delete policy.

## Implementation notes (2026-10-29)

Implemented in `apps/api` (migration `0005_exercise_library_and_programs.sql`, context `exercise-library`, endpoints `/exercises`) and `apps/app` (`/library`). Deviations forced by SQLite/D1, which cannot drop a UNIQUE index or a NOT NULL without rebuilding the table:

- `exercises.name` stays globally unique, so a custom exercise cannot reuse a system name or another user's custom name (case-insensitive check, `409`). The per-owner uniqueness in this ADR is deferred until a table rebuild is worth it.
- Muscle slugs follow the Hevy list (`quadriceps`, `lats`, `upper_back`, ...); the 32 legacy exercises were remapped in the migration and in `db/catalog.ts` (also the source of the Spanish instructions).
- Filtering and search run on the device over the whole catalog (it is a few dozen rows and the list is cached for offline use); the endpoint filters too (`q`, `muscle`, `equipment`, `mine`).
- Editing a custom exercise is API-only for now (`PATCH /exercises/:id`); the app offers create and archive.

## Referenced by

- [exercise-library PRD](../../prd/features/exercise-library.md)
- [database-schema.md](../database-schema.md)
- [ADR-016](./016-workout-data-model-v2.md), [ADR-021](./021-progression-engine.md)
