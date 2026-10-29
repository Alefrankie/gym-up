---
id: ADR-016
title: Workout Data Model v2 — Workout Exercises, Set Types, RPE, Exercise-Type Metrics
type: decision
status: accepted
date: 2026-10-01
---

# ADR-016: Workout Data Model v2 — Workout Exercises, Set Types, RPE, Exercise-Type Metrics

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted. Partially relaxes the session invariants documented in [workout-tracking context](../contexts/workout-tracking/readme.md) (Phase 1).

## Context

The Phase 1 model is `workouts (1 per user per day per routine_day) → workout_entries (one row per set, keyed by exercise_id)`. To reach Hevy parity it has to support:

| Need (Hevy) | Phase 1 blocker |
|---|---|
| Empty / free workout | `workouts.routine_day_id NOT NULL` |
| Several workouts per day | `UNIQUE(user_id, workout_date, routine_day_id)` |
| Exercise order, per-exercise notes, supersets, per-exercise rest, the same exercise twice | No `workout_exercises` level; order comes from `routine_exercises` |
| Warm-up / drop / failure sets | No `set_type` |
| RPE | No `rpe` |
| Bodyweight, assisted, timed and distance exercises (planks, runs, farmer carries) | Only `reps` + `weight` |
| Fractional plates (1.25 kg) | SQLite column declared `integer` (`db/schema.ts`). SQLite affinity keeps 2.5 as REAL by accident, but the declared type is wrong and Drizzle types it as integer |

Phase 1 session invariants (`MinExercises: 3`, `MinDurationMinutes: 15`, warm-up/cool-down minimums) are documented as hard rules. Hevy blocks none of them, and they would block legitimate sessions (a 10-minute ab finisher, a single-exercise test day).

## Decision

### 1. New level: `workout_exercises`

```
workouts 1─* workout_exercises 1─* workout_entries (sets)
```

`workout_exercises(id, workout_id, exercise_id, position, superset_group, rest_seconds, notes, created_at)`

- `position` is a 1-based, dense order inside the workout.
- `superset_group`: nullable integer. Exercises with the same non-null value in the same workout form a superset.
- The same `exercise_id` may appear twice in one workout (two different `workout_exercises` rows).

`workout_entries` gains `workout_exercise_id` (FK, `ON DELETE CASCADE`). It keeps `exercise_id` as a denormalized copy so progress queries need no extra join; the two MUST agree.

### 2. Workouts

- `routine_day_id` becomes **nullable** (empty workout).
- The unique constraint is dropped. New invariant: **at most one `in_progress` workout per user**. It is enforced in the use case and by the partial unique index `(user_id) WHERE status = 'in_progress'`, which works in both Postgres and SQLite.
- New columns: `name TEXT NOT NULL` (defaults to the routine name or "Entrenamiento libre"), `notes TEXT`, `program_id` (nullable FK to `routines.id`, [ADR-018](./018-user-owned-programs.md)), `is_deload BOOLEAN DEFAULT false` ([ADR-021](./021-progression-engine.md)), `readiness_score REAL` (nullable, [ADR-022](./022-readiness-and-recovery.md)), `updated_at`.
- `duration_seconds` is **not stored**. It is derived as `completed_at - started_at`. Editing a past workout may change `started_at` / `completed_at`.

### 3. Sets (`workout_entries`)

| Column | Type | Rule |
|---|---|---|
| `set_type` | TEXT | `normal` \| `warmup` \| `drop` \| `failure`. Default `normal` |
| `rpe` | REAL NULL | 6.0–10.0, step 0.5. Only when the user enables RPE |
| `weight` | REAL (Postgres `DECIMAL(6,2)`) | kg, per [ADR-006](./006-kg-storage.md). Negative values are allowed only for `assisted_bodyweight` (assistance) |
| `reps` | INT **NULL** | Required for rep-based types |
| `duration_seconds` | INT NULL | Required for `duration`, `distance_duration` |
| `distance_m` | REAL NULL | Required for `distance_duration`, `weight_distance` |
| `completed_at` | TIMESTAMP NULL | Set when `completed` flips to true. Used for ordering and conflict resolution ([ADR-025](./025-offline-live-workout.md)) |
| `updated_at` | TIMESTAMP | Last-write-wins key |

Which metric columns are required is decided by `exercises.exercise_type` ([ADR-017](./017-exercise-catalog.md)):

| `exercise_type` | Required | Forbidden |
|---|---|---|
| `weight_reps` | weight ≥ 0, reps | duration, distance |
| `bodyweight_reps` | reps | weight must be 0 |
| `weighted_bodyweight` | reps, weight ≥ 0 (added load) | duration, distance |
| `assisted_bodyweight` | reps, weight ≤ 0 (assistance, shown as positive "−20 kg") | duration, distance |
| `duration` | duration_seconds | — (weight optional, e.g. weighted plank) |
| `distance_duration` | distance_m, duration_seconds | weight |
| `weight_distance` | weight, distance_m | — |

### 4. Set numbering

`set_number` stays a 1-based position inside its `workout_exercise`. It counts every set, warm-ups included. The UI label is derived: warm-ups show `W`, drops `D`, failure `F`, and normal sets show their ordinal among normal sets.

### 5. Relaxed session invariants

| Phase 1 rule | Phase 2 |
|---|---|
| ≥ 1 completed set to finish | **Kept (hard)** |
| ≥ 3 exercises | Removed |
| Duration ∈ [15, 180] min | Soft: duration > 180 min triggers a "¿Olvidaste terminar?" prompt on finish; < 15 min is allowed |
| Warm-up ≥ 5 min / cool-down ≥ 15 min | Display-only reminders (FR-WT-015 kept) |
| ≤ 10 sets per exercise | Raised to 20 (`MaxSetsPerExercise`) |
| ≤ 15 exercises | Raised to 30 (`MaxExercises`) |
| Rest ∈ [30, 600] s | Becomes [0, 600] s. 0 means "no timer" (Hevy "Off") |
| Max 4 consecutive days, ≤ 20 sets/muscle/week | Soft warnings computed by progression ([ADR-022](./022-readiness-and-recovery.md)); never block |
| Weight increase ≤ 5 kg/session, ≤ 10 %/week (`HealthRules`) | Applies to **suggestions only** ([ADR-021](./021-progression-engine.md)). A user may always log what they lifted |

### 6. Migration of Phase 1 data

The backfill runs once and is idempotent (`migrations 0005` SQLite / `004` Postgres, [database-schema.md](../database-schema.md#phase-2-migrations)):

1. For each `(workout_id, exercise_id)` in `workout_entries`, insert one `workout_exercises` row. `position` comes from `routine_exercises.exercise_order` for that workout's `routine_day_id`, falling back to `MIN(created_at)` order.
2. Set `workout_entries.workout_exercise_id`, `set_type = 'normal'`, and `completed_at = created_at` when `completed`.
3. Set `workouts.name = routine_days.focus` (e.g. "Chest + Shoulders + Triceps"). The Phase 1 `day_name` is a weekday, so it is not used.

## Rationale

- `workout_exercises` is the smallest change that unlocks order, supersets, notes, duplicates and per-exercise rest. Hevy's export format has the same three levels.
- Keeping `exercise_id` on sets avoids rewriting every Phase 1 progress query.
- Type-driven metric columns are simpler than a JSON blob and remain queryable for PRs ([ADR-020](./020-personal-records.md)).

## Trade-offs

- **Pro:** Every Phase 1 query keeps working after the backfill.
- **Con:** `exercise_id` is denormalized and has to be kept consistent. The repository sets it from the parent `workout_exercise`; callers never pass it.
- **Con:** Relaxing invariants weakens Phase 1 "safety" rules. They become warnings, which matches Hevy and still informs the user.

## Consequences

- `db/schema.ts`: new `workoutExercises` table and new columns; `weight` becomes `real`.
- `supabase/migrations/004_workout_model_v2.sql`; drizzle `0005_workout_model_v2.sql`.
- `WorkoutEntryRules` and `WorkoutSessionRules` constants are updated in [story-7.1](../../stories/phase-2/round-7/story-7.1.md).
- RLS: `workout_exercises` read-all, write-own via workout ownership (same as `workout_entries`, [ADR-004](./004-rls-visibility.md)).

## Referenced by

- [database-schema.md](../database-schema.md)
- [workout-tracking context](../contexts/workout-tracking/readme.md)
- [ADR-017](./017-exercise-catalog.md), [ADR-020](./020-personal-records.md), [ADR-025](./025-offline-live-workout.md)
