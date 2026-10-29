---
story_id: "7.2"
round: "round-7"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/exercise-library/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["exercise-library"]
  prd_requirements: ["FR-EL-010", "FR-EL-011"]
  architecture_decisions: ["ADR-017"]
  flows: []
blocked_by: ["story-7.1"]
blocks: ["story-7.3", "story-8.1"]
---

# Story 7.2 — Exercise library seed (107 exercises)

Parent: [../readme.md](../readme.md)

## Summary

Seeds the system catalog of [ADR-017](../../../architecture/decisions/017-exercise-catalog.md): 107 exercises with primary and secondary muscles, equipment, exercise type and **Spanish instructions of 2–6 steps**, from one data file used by both backends. The 32 Phase 1 exercises are updated **in place** by name, so their IDs and every FK to them (`workout_entries`, `routine_exercises`, `workout_exercises`) stay valid. The result is the content half of H11 (100+ exercises with instructions) and the data that the picker (7.3), the templates (8.1) and the progression increments (10.2) read.

## Files in scope

**Modify**

- `db/seed.ts` — after the Phase 1 inserts, `main()` calls `seedExerciseLibrary(db)`. `db/seed.ts` runs `main()` on import, so the function itself lives in its own module (see [Decisions](#decisions)).
- `src/pages/history.astro` — the muscle shown next to an exercise uses `MuscleGroupLabels` (FR-EL-011) instead of the raw `muscle_group` code. Legacy codes (`back`, `legs`, `quads`, `core`) are replaced by the seed, so a raw code would now read `lats` or `abdominals`.
- `src/lib/contexts/exercise-library/domain/exercise-library.constants.ts` (created in 7.1) — adds `muscleGroupLabel(value: string): string`, which returns `MuscleGroupLabels[value]` and falls back to the raw value.
- `package.json` — scripts `db:seed:exercises` (`tsx db/seed-exercise-library.ts`) and `db:generate-exercise-seed` (`tsx scripts/generate-exercise-seed.ts`).
- `tests/workout-tracking/phase-1-fixture.regression.test.ts` — also runs `seedExerciseLibrary` on the migrated fixture.

**Create**

- `db/seed-data/exercises.ts` — the single source: `EXERCISE_SEED: ExerciseSeedRow[]`.
- `db/seed-exercise-library.ts` — exports `seedExerciseLibrary(db)`; runnable standalone.
- `scripts/generate-exercise-seed.ts` — renders `EXERCISE_SEED` into SQL.
- `supabase/migrations/005_exercise_library_seed.sql` — generated, data-only.
- `tests/exercise-library/test-db.ts` — in-memory SQLite harness with the 0005 DDL (the `tests/workout-tracking/test-db.ts` pattern).
- `tests/exercise-library/mothers/exercise.mother.ts` — `ExerciseMother.system`, `custom`, `archived` ([context](../../../architecture/contexts/exercise-library/readme.md#testing)).
- `tests/exercise-library/exercise-seed-data.test.ts`, `seed-exercise-library.test.ts`, `generate-exercise-seed.test.ts`.
- `tests/supabase/exercise-seed.integration.test.ts`.

**Not in scope** (must not change): `db/schema.ts`, `db/migrations/**`, `supabase/migrations/004_*`, the routine seed in `db/seed.ts`, every other page.

## Happy Path

1. A developer runs `npm run db:seed:exercises` on a local DB that already holds the 32 Phase 1 exercises (or `npm run db:seed` on a fresh one).
2. `seedExerciseLibrary(db)` reads `EXERCISE_SEED`. For each row it looks up a **system** exercise (`owner_id IS NULL`) by `lower(name)`: found → update `muscle_group`, `secondary_muscles`, `equipment`, `exercise_type`, `instructions` (the `id` never changes); missing → insert. Custom exercises are never touched.
3. The catalog now has 107 system rows. A Phase 1 workout still shows its exercises, and `/history` shows Spanish muscle labels (FR-EL-011).
4. For Supabase, the developer runs `npm run db:generate-exercise-seed`, which rewrites `supabase/migrations/005_exercise_library_seed.sql` from the same data file; `supabase db push` applies it with the same upsert semantics.
5. Running either path a second time changes nothing.

## Decisions

- **Seed functions live outside `db/seed.ts`.** `db/seed.ts` calls `main()` at import time, so tests cannot import from it. `seedExerciseLibrary` is exported from `db/seed-exercise-library.ts` and called by `main()`. The context readme names `db/seed.ts`, so the docs task fixes that line. The standalone script is also what existing local DBs run, because the Phase 1 seed fails on duplicates.
- **Instruction style** (Hevy-like, Spanish, informal "tú" as in the rest of the UI): imperative verbs, one action per step, ≤ 160 characters per step, no Markdown other than the `1. …` numbering, 2–6 steps. Stored as `"1. Paso uno\n2. Paso dos"`.
- **No `video_url` in the seed.** The column is optional ([ADR-017 §4](../../../architecture/decisions/017-exercise-catalog.md)) and no verified links exist. (Simplest option.)
- **Ambiguous legacy names** (`Row`, `Chest Press`, `Incline Press`, `Calves`, `Leg Curl`) keep their names; step 1 of their instructions names the variant, as in the [schema doc](../../../architecture/database-schema.md#exercise-library-seed).
- **Upsert key and SQL form.** SQLite: select by `lower(name)` with `owner_id IS NULL`, then update or insert inside one transaction. Postgres: `INSERT … ON CONFLICT (lower(name)) WHERE owner_id IS NULL DO UPDATE SET …`, which matches `uq_exercises_system_name`. New rows get `gen_random_uuid()` / `crypto.randomUUID()`. Single quotes in text are doubled by the generator.
- **Generated file stays in sync by test.** A unit test regenerates the SQL in memory and compares it with the committed file, so editing the data file without regenerating fails CI.
- **Secondary muscles** are stored as JSON text (`'["triceps","shoulders"]'`), the same on both backends; `—` in the schema table is `'[]'`.

## Acceptance Criteria

- AC-7.2-01: `EXERCISE_SEED` has exactly 107 rows, with unique `lower(name)`, and every `equipment`, `exerciseType`, `muscleGroup` and `secondaryMuscles` value belongs to the closed enums of `exercise-library.constants.ts`; each row has ≤ 3 secondary muscles and none equals the primary (FR-EL-010).
- AC-7.2-02: Every `MuscleGroups` value except `neck` and `other` is the primary muscle of at least one row, and cardio rows exist with types `distance_duration` or `duration` (FR-EL-010).
- AC-7.2-03: Every row has 2–6 numbered steps, no step is empty, and the text is Spanish; names are English (FR-EL-010, FR-EL-011). The five ambiguous legacy rows state their variant in step 1.
- AC-7.2-04: Given a DB with the 32 Phase 1 exercises, when `seedExerciseLibrary` runs, then the 32 rows keep their `id` and `name`, receive the metadata of the schema table (for example `Row` → `upper_back`, `barbell`, `weight_reps`; `Calves` → `calves`; `Lunges` → `quadriceps`), and 75 rows are inserted; the table holds 107 system rows.
- AC-7.2-05: Running `seedExerciseLibrary` twice leaves every row byte-identical (ids, columns) and the row count at 107.
- AC-7.2-06: On an empty `exercises` table the function inserts 107 rows with `owner_id IS NULL`, `is_archived = 0`.
- AC-7.2-07: A custom exercise (`owner_id` set) named like a system exercise is not modified by the seed, and does not make it fail.
- AC-7.2-08: Phase 1 regression: on the migrated fixture, after seeding, history, progress and family numbers equal `phase-1.expected.json`, and the number of `workout_entries` and `routine_exercises` rows pointing at the 32 legacy IDs is unchanged.
- AC-7.2-09: `005_exercise_library_seed.sql` contains no DDL, equals the generator output, and applied twice on Postgres leaves 107 system rows with the legacy `id`s unchanged.
- AC-7.2-10: After the seed, for every row of `EXERCISE_SEED` the SQLite table and the Supabase table (`STORAGE_BACKEND=supabase` integration test) hold the same name, equipment, type, primary and secondary muscles.
- AC-7.2-11: `/history` renders the Spanish label of the exercise's muscle (for example "Dorsales" for `lats`); an unknown code falls back to the raw value without throwing (FR-EL-011).
- AC-7.2-12: Reading `exercises` as any authenticated Supabase user returns the 107 system rows (read-all policy stays), and an update of a system row is rejected (RLS from 004).

## Tasks

- [ ] `T7.2-01` - Define `ExerciseSeedRow` and write `db/seed-data/exercises.ts` rows 1–32 (chest, shoulders, triceps, back, biceps) with Spanish instructions.
- [ ] `T7.2-02` - Rows 33–66 (back remainder, lower back, traps, forearms, core).
- [ ] `T7.2-03` - Rows 67–107 (legs, glutes, calves, cardio, full body).
- [ ] `T7.2-04` - `tests/exercise-library/exercise-seed-data.test.ts` (AC-01, 02, 03) and `tests/exercise-library/test-db.ts`, `exercise.mother.ts`.
- [ ] `T7.2-05` - `seedExerciseLibrary(db)` in `db/seed-exercise-library.ts` plus the standalone entry point; call it from `db/seed.ts` and add the npm scripts.
- [ ] `T7.2-06` - `seed-exercise-library.test.ts` (AC-04, 05, 06, 07).
- [ ] `T7.2-07` - `scripts/generate-exercise-seed.ts` and the generated `supabase/migrations/005_exercise_library_seed.sql`; `generate-exercise-seed.test.ts`.
- [ ] `T7.2-08` - `tests/supabase/exercise-seed.integration.test.ts` (AC-09, 10, 12).
- [ ] `T7.2-09` - `muscleGroupLabel` helper plus `history.astro` using it (AC-11).
- [ ] `T7.2-10` - Extend the Phase 1 regression test with the seed (AC-08).
- [ ] `T7.2-11` - Update docs: mark the `seedExerciseLibrary(db)` row `implemented`, fix the `db/seed.ts` location drift in the exercise-library context, add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/exercise-library/exercise-seed-data.test.ts` | unit, table-driven over rows | Count, uniqueness, enum validity, muscle coverage, cardio, 2–6 steps (01, 02, 03) |
| `tests/exercise-library/seed-exercise-library.test.ts` | repo (real SQLite) | In-place legacy update, 75 inserts, idempotency, empty table, custom rows untouched (04–07) |
| `tests/exercise-library/generate-exercise-seed.test.ts` | unit | Committed SQL equals generator output, data-only, quotes escaped (09) |
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` (extended) | integration | Same numbers and FK counts after the seed (08) |
| `tests/supabase/exercise-seed.integration.test.ts` | integration-RLS | 107 rows readable, update of a system row rejected, backend parity (10, 12) |
| `tests/exercise-library/muscle-label.test.ts` | unit | `muscleGroupLabel` lookup with fallback (11) |

Worked example for the legacy-update table test (expected state after the seed):

| Legacy name | `muscle_group` before → after | Equipment | Type |
|---|---|---|---|
| `Row` | `back` → `upper_back` | `barbell` | `weight_reps` |
| `Lat Pulldown` | `back` → `lats` | `cable` | `weight_reps` |
| `Pullover` | `back` → `lats` | `dumbbell` | `weight_reps` |
| `Squat` | `quads` → `quadriceps` | `barbell` | `weight_reps` |
| `Crunches` | `core` → `abdominals` | `bodyweight` | `bodyweight_reps` |
| `Calves` | `legs` → `calves` | `machine` | `weight_reps` |
| `Lunges` | `legs` → `quadriceps` | `dumbbell` | `weight_reps` |
| `Adductors` | `legs` → `adductors` | `machine` | `weight_reps` |

## Out of Scope

- Browsing, search, detail page and picker UI — story [7.3](./story-7.3.md).
- Custom exercises and their uniqueness use cases — story [7.4](./story-7.4.md).
- Exercise videos (`video_url`) and hosted media — no story (external links only, ADR-017 §4).
- Program templates that reference these exercises by name — story [8.1](../round-8/story-8.1.md).
- Equipment-based increments that read `equipment` — story 10.2.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
