---
story_id: "7.1"
round: "round-7"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/workout-tracking/readme.md"
size: "L"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking", "exercise-library"]
  prd_requirements: []
  architecture_decisions: ["ADR-016", "ADR-017"]
  flows: []
blocked_by: []
blocks: ["story-7.2", "story-9.1"]
---

# Story 7.1 — Workout data model v2 migration

Parent: [../readme.md](../readme.md)

## Summary

Migrates the persistence model to [ADR-016](../../../architecture/decisions/016-workout-data-model-v2.md) and the exercise columns of [ADR-017](../../../architecture/decisions/017-exercise-catalog.md): the new `workout_exercises` level, set types, RPE, per-type metrics, nullable `routine_day_id`, `weight` as `real`, the `exercises` catalog columns, the training-settings columns of `profiles`, and the relaxed session constants. It ships **no UI**. Every Phase 1 workout is backfilled into the new shape and Phase 1 pages keep returning the same numbers, which a fixture DB (`tests/fixtures/phase-1.db`) proves from now on for every later migration story ([phase rule 6](../readme.md#6-phase-1-compatibility)). It is the data prerequisite for H1–H10 and H8 (exercise types) in the Phase 2 exit criteria.

## Files in scope

**Modify** (existing paths)

- `db/schema.ts` — `exercises` (new columns, drop `.unique()` on `name`, two partial unique indexes), `workouts` (nullable `routineDayId`, `name`, `notes`, `programId`, `isDeload`, `readinessScore`, `updatedAt`, partial indexes), `workoutEntries` (`workoutExerciseId`, `setType`, `reps` nullable, `weight` → `real`, `rpe`, `durationSeconds`, `distanceM`, `completedAt`, `updatedAt`), `profiles` (training-settings columns), new `workoutExercises` table. Shapes: [workout-tracking context](../../../architecture/contexts/workout-tracking/readme.md#drizzle-schema-dbschemats-story-71) and [exercise-library context](../../../architecture/contexts/exercise-library/readme.md#schema-dbschemats-story-71). `deletedAt` is **not** added here (story 12.3).
- `db/migrations/meta/_journal.json` — entry for `0005_workout_model_v2`. `package.json` `db:migrate` changes only if the rebuild safety gate in [Decisions](#decisions) requires `db/migrate.ts`.
- `src/lib/contexts/workout-tracking/domain/workout-tracking.constants.ts` — values per ADR-016 §5 (see [Decisions](#decisions)).
- `src/lib/contexts/workout-tracking/domain/workout-tracking.types.ts` — `WorkoutSet`, `SetMetrics`, `WorkoutExerciseWithSets`, `UpsertOutcome`, `UpsertResult<T>`.
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` — `WorkoutDetailEntry.reps` and `WorkoutEntryPatch` follow the nullable `reps`; `WorkoutEntryPatch` gains `setType`, `rpe`, `completedAt`.
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository.ts` and `.../supabase/supabase-workout.repository.ts` — `create` passes `name`; `addEntry` resolves or creates the parent `workout_exercises` row and sets `workout_exercise_id`, `set_type = 'normal'`, `completed_at`; `updateEntry` sets `completed_at` / `updated_at`; `getHistoryByUser` uses a LEFT JOIN on `routine_days` with `COALESCE(routine_days.day_name, workouts.name)` (the day name stays what Phase 1 showed).
- `src/lib/contexts/workout-tracking/application/start-workout.use-case.ts` — passes `name: routineDay.dayName`; `isUniqueConstraintError` also matches `uq_workouts_one_in_progress`. Behaviour is otherwise unchanged (idempotent per user and date).
- `src/lib/contexts/workout-tracking/application/log-set.use-case.ts` — types only (`reps` is nullable at DB level; Phase 1 input stays required).
- `src/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository.ts`, `.../sqlite-exercise-query.repository.ts` and their `supabase/` twins; `src/lib/contexts/public-view/infrastructure/**/*-public-workout.repository.ts` — type fallout of nullable `reps` and `real` weight (`reps IS NOT NULL` in volume and history queries).
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — exports `workoutExerciseRepository`.
- `tests/workout-tracking/test-db.ts`, `tests/progress/test-db.ts`, `tests/public-view/test-db.ts` — hand-written DDL updated to the 0005 shape (same tables and columns as `db/schema.ts`).
- `tests/db/migrate.test.ts` — also asserts `workout_exercises` and `0005` are present.
- `package.json` — script `fixtures:phase-1` (`tsx scripts/build-phase-1-fixture.ts`).

**Create**

- `db/migrations/0005_workout_model_v2.sql` (and `db/migrations/meta/0005_snapshot.json` only if `drizzle-kit generate` produces it, see [Decisions](#decisions)).
- `supabase/migrations/004_workout_model_v2.sql` — the DDL, RLS and backfill of [database-schema.md → 004](../../../architecture/database-schema.md#004--workout-model-v2-adr-016-adr-017), plus `upsert_workout_exercise(p_user UUID, p_payload JSONB)` and `upsert_workout_set(p_user UUID, p_payload JSONB)` (`SECURITY INVOKER`, last-write-wins on `updated_at`).
- `src/lib/contexts/exercise-library/domain/exercise-library.constants.ts` — the complete constants file of the [exercise-library context](../../../architecture/contexts/exercise-library/readme.md#exercise-libraryconstantsts): `MuscleGroups`, `Equipments`, `ExerciseTypes`, label maps, `UncoveredMuscleGroups`, `ExerciseTypeMetricRules`, `CustomExerciseRules`, `ExerciseCatalogRules`. It is a pure shared kernel that `set-metrics.ts` imports; the rest of the context starts in 7.2 and 7.3.
- `src/lib/contexts/workout-tracking/domain/set-metrics.ts`, `set-label.ts`, `workout-exercise.repository.ts`, `legacy-workout-exercise-id.ts`.
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout-exercise.repository.ts`, `.../supabase/supabase-workout-exercise.repository.ts`.
- `scripts/build-phase-1-fixture.ts`, `tests/fixtures/phase-1.db`, `tests/fixtures/phase-1.expected.json`, `tests/fixtures/phase-1-fixture.ts` (copies the DB to a temp file and applies pending migrations).
- `tests/workout-tracking/mothers/workout.mother.ts`, `workout-exercise.mother.ts`, `workout-set.mother.ts`.
- Tests listed in the [Test Plan](#test-plan).

**Not in scope** (must not change): every `src/pages/**` and `src/components/**`, `src/lib/client/auto-save.ts`, `routine.repository.ts` and its implementations, `GetTodayWorkoutUseCase`, `db/seed.ts`.

## Happy Path

1. A developer applies the migrations: `drizzle-kit migrate` (SQLite, `0005`) and `supabase db push` (Postgres, `004`). They create `workout_exercises`, add the v2 columns and indexes, and backfill history ([ADR-016 §6](../../../architecture/decisions/016-workout-data-model-v2.md)).
2. Backfill, per `(workout_id, exercise_id)` of `workout_entries`: one `workout_exercises` row, `position` from `routine_exercises.exercise_order` of the workout's routine day (fallback: order of first entry). Each entry gets `workout_exercise_id`, `set_type = 'normal'` and `completed_at = created_at` when `completed`. Each workout gets `name = routine_days.focus`.
3. A user opens `/history`, `/progress`, `/family` and the Phase 1 workout page. Same sets, same volumes, same charts as before the migration.
4. The user logs a set in a Phase 1 workout (`POST /api/workout-entries`). `addEntry` finds or creates the `workout_exercises` row for the exercise and writes the set with `workout_exercise_id`, so new Phase 1 data is already readable through the v2 shape.
5. Later stories read the v2 shape through `WorkoutExerciseRepository`, `validateSetMetrics`, `deriveSetLabels` and the `ExerciseTypeMetricRules` table created here.

## Decisions

- **Hand-written SQLite migration.** `db/migrations/meta` only holds snapshots 0000 and 0001 (0002–0004 were written by hand), so `drizzle-kit generate` would diff against a stale baseline. Write `0005_workout_model_v2.sql` by hand as table rebuilds, add the `_journal.json` entry, and use `drizzle-kit generate` only to confirm that the remaining diff is empty. (Simplest option that keeps the journal consistent.) Two SQLite constraints force the rebuilds: it cannot alter nullability or column types (`workouts.routine_day_id`, `workout_entries.reps` and `weight`), and `ALTER TABLE ADD COLUMN` rejects a non-constant default such as `DEFAULT (unixepoch())` (`exercises.created_at`, `workouts.updated_at`, `workout_entries.updated_at`).
- **Rebuild safety gate.** Dropping a parent table whose children use `ON DELETE CASCADE` (`exercises`, `workouts`) deletes the child rows while foreign keys are on (better-sqlite3 enables them by default), and `PRAGMA foreign_keys=OFF` is ignored inside a transaction, which is how Drizzle's SQLite migrator applies a migration. T7.1-02 must therefore prove that the chosen mechanism keeps every child row: the regression test compares the row counts of `workouts`, `workout_entries` and `routine_exercises` before and after, and runs `PRAGMA foreign_key_check`. If the stock migrator does not honour the pragma, add `db/migrate.ts` (open the DB, `PRAGMA foreign_keys=OFF`, run `migrate()`, `PRAGMA foreign_key_check`, `PRAGMA foreign_keys=ON`) and point `db:migrate` at it.
- **Drop `exercises_name_unique`** with `DROP INDEX`, then create `uq_exercises_system_name` and `uq_exercises_owner_name` as in the schema doc.
- **Constants.** `WorkoutEntryRules.MinRestSeconds` 30 → 0, `MaxSetsPerExercise` 10 → 20, new `MinRpe`, `MaxRpe`, `RpeStep`, `RestAdjustStepSeconds`, `MinDurationSeconds`, `MaxDurationSeconds`. `WorkoutSessionRules.MaxExercises` 15 → 30; `MinDurationMinutes`, `MinExercises`, `MaxDurationMinutes` removed; added `ForgotToFinishMinutes: 180`, `MaxNameLength: 60`, `DefaultName: 'Entrenamiento libre'`, `ClockSkewToleranceMs: 300_000`. `SetTypes`, `SetTypeLabels` and `WeightUnits` are new. Exact values: [workout-tracking context → constants](../../../architecture/contexts/workout-tracking/readme.md#workout-trackingconstantsts-phase-2). `RoutineTypes`, `Weekdays`, `TrainingFrequencyRules` and `CardioRules` stay, because Phase 1 code reads them until story 8.3.
- **Removed keys have no readers.** `grep` for `MinDurationMinutes|MinExercises|MaxDurationMinutes` over `src/` must return nothing before the story closes.
- **RPC scope.** The workout-tracking readme lists four RPCs for migration 004. This story ships only the two upserts that its `WorkoutExerciseRepository` calls. `start_workout_v2` and `finish_workout` take a `WorkoutSkeleton` and a `FinishPlan` that stories 9.1 and 9.3 define and test, so they ship with those stories. (Simplest option: no function without a caller and a test.)
- **Phase 1 compat id.** The Supabase `addEntry` path derives `workout_exercises.id` deterministically from `(workoutId, exerciseId)` (`legacyWorkoutExerciseId`, SHA-1 based, UUID formatted) and inserts with `ON CONFLICT (id) DO NOTHING`, because the Phase 1 auto-save sends several sets of one exercise concurrently. SQLite does the same lookup inside `db.transaction`. The helper is deleted with `POST /api/workout-entries` in story 9.2. Backfilled rows keep random IDs.
- **`set_type` filtering of progress queries** is not needed yet: no non-`normal` set can exist before story 9.2. Excluding warm-ups from volume and records belongs to 10.1 and 11.2.
- **No faker dependency.** `package.json` has none, so Object Mothers use `crypto.randomUUID()` and per-class counters instead of the `faker` calls shown in the context docs.

## Acceptance Criteria

- AC-7.1-01: Given an empty database, when migration `0005` (SQLite, after 0000–0004) and `004` (Postgres, after 001–003) are applied, then `workout_exercises` exists, and the column lists of `exercises`, `workouts`, `workout_entries`, `workout_exercises` and `profiles` match `db/schema.ts` (a test compares them).
- AC-7.1-02: Given `tests/fixtures/phase-1.db`, when the pending migrations are applied, then every `(workout_id, exercise_id)` pair of the fixture has exactly one `workout_exercises` row, every `workout_entries.workout_exercise_id` is non-null, and `workout_entries.exercise_id` equals the parent's `exercise_id`. The row counts of `exercises`, `workouts`, `workout_entries`, `routine_exercises` are unchanged by the migration and `PRAGMA foreign_key_check` returns no row (no cascade loss).
- AC-7.1-03: Backfilled `position` follows `routine_exercises.exercise_order` of the workout's routine day, is 1-based and dense per workout, and falls back to first-entry order for an exercise missing from the routine.
- AC-7.1-04: Backfilled entries have `set_type = 'normal'`, `completed_at = created_at` when `completed = 1` and `NULL` otherwise. Backfilled workouts have `name = routine_days.focus`.
- AC-7.1-05: Re-running the backfill statements (SQLite) or the whole migration file (Postgres) changes no row and creates no duplicate.
- AC-7.1-06: Given the migrated fixture, `GetWorkoutHistoryUseCase`, `GetExerciseListUseCase`, `GetExerciseHistoryUseCase`, `CalculateStreakUseCase`, `GetCalendarDataUseCase` and the public-view member stats return the numbers recorded in `tests/fixtures/phase-1.expected.json`: set counts, volumes, chart points, streaks and family totals (AC-R7-02). The history day names equal the Phase 1 values.
- AC-7.1-07: A workout with `routine_day_id = NULL` can be inserted. Two completed workouts of the same user, date and routine day can coexist. A second `in_progress` workout for the same user is rejected by `uq_workouts_one_in_progress` on both backends.
- AC-7.1-08: `weight` round-trips fractional and negative values (`1.25`, `52.5`, `-20`) on both backends, and the fixture's `2.5` kg row is unchanged after migration.
- AC-7.1-09: At DB level two system exercises with the same `lower(name)` are rejected, two custom exercises of one owner with the same `lower(name)` are rejected (archived rows included), the same name under two owners is allowed, and the 32 Phase 1 exercise IDs and names are unchanged.
- AC-7.1-10: `WorkoutEntryRules` and `WorkoutSessionRules` hold the ADR-016 §5 values, the removed keys no longer exist, and `npm run typecheck` is clean.
- AC-7.1-11: Given a Phase 1 in-progress workout, `LogSetUseCase` (through `addEntry`) creates one `workout_exercises` row for the first set of an exercise and reuses it for the next sets, with `set_type = 'normal'` and `workout_exercise_id` set. On Supabase, concurrent calls converge on one row.
- AC-7.1-12: `validateSetMetrics` returns `ok`, `required`, `forbidden` or `out_of_range` as in the ADR-016 §3 table for all 7 exercise types, for `completed: true` and `completed: false`. `deriveSetLabels` returns `W`, `D`, `F` and normal ordinals ([ADR-016 §4](../../../architecture/decisions/016-workout-data-model-v2.md)).
- AC-7.1-13: `WorkoutExerciseRepository` (both backends): `upsertSet` copies `workoutId` and `exerciseId` from the parent and returns `created`, `updated` or `stale` by `updatedAt`. `removeSet` renumbers `set_number` densely and `remove` re-densifies `position`. Deleting a workout cascades to `workout_exercises` and sets.
- AC-7.1-14: Supabase RLS, as a non-owner: cannot insert, update or delete `workout_exercises` or sets of another user's workout, but can read them. Cannot insert an `exercises` row with another `owner_id`, cannot update a system exercise or a sibling's custom exercise, cannot delete any exercise.
- AC-7.1-15: `exercise-library.constants.ts` enums equal the inline Drizzle enums of `db/schema.ts`, and every enum value has a label.
- AC-7.1-16: With `STORAGE_BACKEND=sqlite` and `STORAGE_BACKEND=supabase` the composition roots build, and the Phase 1 suites of workout-tracking, progress, public-view and nutrition pass unchanged apart from DDL.

## Tasks

- [ ] `T7.1-01` - `db/schema.ts`: `exercises`, `workouts`, `workoutEntries` and `profiles` columns, `workoutExercises` table, indexes (`uq_workouts_one_in_progress`, `idx_workouts_completed`, `idx_workout_exercises_workout`, `idx_entries_workout_exercise`).
- [ ] `T7.1-02` - Write `db/migrations/0005_workout_model_v2.sql` (table rebuilds, index changes, backfill) and the journal entry; confirm with `drizzle-kit generate` that no diff remains.
- [ ] `T7.1-03` - Write `supabase/migrations/004_workout_model_v2.sql` from the schema doc (verify the Phase 1 constraint names the doc marks "verify name in 001"), plus the two upsert functions.
- [ ] `T7.1-04` - `exercise-library.constants.ts` and `tests/exercise-library/exercise-library.constants.test.ts`.
- [ ] `T7.1-05` - Update `workout-tracking.constants.ts` and `workout-tracking.types.ts`; remove dead keys; fix type fallout in the progress and public-view repositories (nullable `reps`, `real` weight).
- [ ] `T7.1-06` - Pure modules `set-metrics.ts` and `set-label.ts` with table-driven tests.
- [ ] `T7.1-07` - `WorkoutExerciseRepository` port, `SqliteWorkoutExerciseRepository`, `legacy-workout-exercise-id.ts` and tests.
- [ ] `T7.1-08` - `SupabaseWorkoutExerciseRepository` (RPC upserts) and composition wiring.
- [ ] `T7.1-09` - Phase 1 compat in `SqliteWorkoutRepository` and `SupabaseWorkoutRepository` (`create` name, `addEntry`, `updateEntry`, history LEFT JOIN) and in `StartWorkoutUseCase`.
- [ ] `T7.1-10` - Update the three `test-db.ts` DDLs and fix any Phase 1 test that breaks.
- [ ] `T7.1-11` - `scripts/build-phase-1-fixture.ts`: apply 0000–0004, seed the 32 exercises and 2 routines, insert users and workouts (see below), write `phase-1.db` and `phase-1.expected.json` from raw SQL aggregates.
- [ ] `T7.1-12` - `tests/fixtures/phase-1-fixture.ts` loader and `phase-1-fixture.regression.test.ts`.
- [ ] `T7.1-13` - Object Mothers for workouts, workout exercises and sets.
- [ ] `T7.1-14` - `tests/supabase/rls-workout-exercises.integration.test.ts` and `rls-exercises.integration.test.ts` (non-owner cases).
- [ ] `T7.1-15` - Run both backends (unit suites on SQLite, integration suites on Supabase) and `typecheck`.
- [ ] `T7.1-16` - Update docs: mark `set-metrics.ts`, `set-label.ts` and `WorkoutExerciseRepository` as implemented in the workout-tracking context, fix any doc/code drift found, add Implementation Evidence.

**Fixture content** (`scripts/build-phase-1-fixture.ts`): 3 users (`hombre`, `mujer` and a sibling for family stats); 8 workouts across both routines on distinct days, one of them `in_progress`; at least 40 entries covering `completed = 0`, a fractional weight (`2.5`), an exercise that is not in the routine day, and an exercise performed on two days. `phase-1.expected.json` is computed with SQL, not with app code, so refactors cannot silently change the baseline.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` | integration (real SQLite file) | Backfill structure, order, names, idempotency, same history, progress and family numbers (02–06, 08) |
| `tests/db/migrate.test.ts` | unit | Migration file contains `workout_exercises`, journal entry, schema column parity (01) |
| `tests/workout-tracking/workout-model-v2.constraints.test.ts` | repo | Nullable routine day, several per day, one in-progress, REAL weight, exercise name indexes (07, 08, 09) |
| `tests/workout-tracking/set-metrics.test.ts` | unit, table-driven | 7 types × required / forbidden / range × completed / draft (12) |
| `tests/workout-tracking/set-label.test.ts` | unit, table-driven | Label derivation (12) |
| `tests/workout-tracking/sqlite-workout-exercise.repository.test.ts` | repo | Upsert idempotency, LWW `stale`, parent copy, dense numbering, cascade (13) |
| `tests/workout-tracking/sqlite-workout.repository.test.ts`, `log-set.use-case.test.ts`, `start-workout.use-case.test.ts` (updated) | repo / use-case | Phase 1 compat: `addEntry` creates and reuses the parent row, start keeps its idempotency (10, 11) |
| `tests/workout-tracking/legacy-workout-exercise-id.test.ts` | unit | Same inputs give the same UUID-formatted id, different inputs differ (11) |
| `tests/workout-tracking/workout-tracking-constants.test.ts` | unit | ADR-016 §5 values, removed keys (10) |
| `tests/exercise-library/exercise-library.constants.test.ts` | unit | Enums equal Drizzle enums, labels complete (15) |
| `tests/supabase/rls-workout-exercises.integration.test.ts` | integration-RLS | Non-owner insert, update and delete rejected, read allowed, upsert functions respect RLS (13, 14) |
| `tests/supabase/rls-exercises.integration.test.ts` | integration-RLS | Insert with foreign `owner_id`, update of a system or foreign custom row, delete (14) |
| `tests/workout-tracking/composition.test.ts` (updated) | unit | Both backends build (16) |

Worked examples for the table tests:

| `deriveSetLabels` input (set types in order) | Output |
|---|---|
| `normal, warmup, normal, drop, failure, normal` | `1, W, 2, D, F, 3` |
| `warmup, warmup, normal` | `W, W, 1` |
| `normal, normal` | `1, 2` |

| `validateSetMetrics` (type, metrics, completed) | Result |
|---|---|
| `weight_reps`, `{ weight: 60, reps: 8 }`, true | ok |
| `weight_reps`, `{ weight: 60, reps: null }`, true | required `reps` |
| `weight_reps`, `{ weight: 60, reps: null }`, false | ok (draft) |
| `bodyweight_reps`, `{ weight: 10, reps: 8 }`, true | forbidden `weight` |
| `assisted_bodyweight`, `{ weight: -20, reps: 6 }`, true | ok |
| `assisted_bodyweight`, `{ weight: 20, reps: 6 }`, true | out_of_range `weight` |
| `duration`, `{ durationSeconds: 60, weight: 10 }`, true | ok (optional weight) |
| `distance_duration`, `{ distanceM: 5000, durationSeconds: 1800, reps: 5 }`, true | forbidden `reps` |
| `weight_distance`, `{ weight: 32, distanceM: 40 }`, true | ok |
| any type, `{ reps: 101 }` | out_of_range `reps` |
| any type, `{ rpe: 7.25 }` | out_of_range `rpe` |

## Out of Scope

- Exercise catalog data and the seed — story [7.2](./story-7.2.md); library pages and picker — stories [7.3](./story-7.3.md) and [7.4](./story-7.4.md).
- `start_workout_v2` and `finish_workout` functions, `WorkoutRepository.createFromSkeleton`, `findAggregate` and `finish` — stories 9.1 and 9.3.
- Live workout island, `UpsertSetUseCase`, retiring `POST /api/workout-entries` and `auto-save.ts` — stories 9.1 and 9.2.
- `deleted_at` tombstones and `purgeTombstones` — story 12.3.
- Programs, `program_id` population and the routine tables — Round 8 (`workouts.program_id` is created here and stays `NULL`).
- Excluding warm-up and drop sets from volume and records — stories 10.1 and 11.2.
- UI for the new `profiles` training-settings columns — story 9.4.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
