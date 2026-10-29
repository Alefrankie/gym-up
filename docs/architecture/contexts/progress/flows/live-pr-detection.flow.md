# Live PR Detection Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-PR-008 … FR-PR-011](../../../../prd/features/progress.md#personal-records)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [10.1](../../../../stories/phase-2/round-10/story-10.1.md) |
| Decisions | [ADR-020](../../../decisions/020-personal-records.md), [ADR-015](../../../decisions/015-live-workout-react-island.md), [ADR-025](../../../decisions/025-offline-live-workout.md) |

## Happy Path

### Step 1 - Load Baselines

`/workout/[id]` SSR (workout-tracking) calls `recordBaselinePort.getBaselines(userId, exerciseIds, { excludeWorkoutId: workoutId })`. `RecordBaselineService` reads each exercise's eligible sets (`completed`, not `warmup`) of the user's completed workouts and returns `Record<exerciseId, RecordBaseline>` (`hasHistory`, `best` per record type). The baselines go into the island props.

### Step 2 - Check a Set

The user checks Bench Press set 2: 102.5 kg × 3. The reducer marks it `completed` (FR-WT-033).

### Step 3 - Detect Locally

The island runs `detectPrsInSequence(baseline, setsOfThisExercise)` from the bundled `personal-records.ts` (same module as the server). Result: set 2 → `['heaviest_weight']`. No network call, so it works offline.

### Step 4 - Badge and Feedback

The row shows `PrBadge` "🏆 Peso máximo". A short toast ("¡Nuevo récord! Peso máximo: 102.5 kg") and a haptic pulse (`navigator.vibrate`, when supported) fire **once per set** (the island remembers which `(setId, type)` pairs it already announced).

### Step 5 - Later Sets Compete With Earlier Ones

Set 3 (90 × 8 = 720) beats `best_set_volume` 600 → badge. Set 4 (90 × 8) ties 720 → no badge. Set 5 (80 × 10) pushes the session volume past the record → "Mejor serie" + "Mejor sesión".

### Step 6 - Summary and Elsewhere

On finish, the summary (FR-WT-036) lists the PRs from `GetWorkoutPrsUseCase` (server recomputation, same rules). The feed card, `/workouts/[id]` and the share image use `prCountPort.countByWorkouts` / `listByWorkout`.

---

## Edge Case: First Exposure

`hasHistory = false` (the user never completed this exercise) → `detectPrs` returns `[]` for every set. No badges on a first session (Hevy behaviour, ADR-020 §3).

## Edge Case: Uncheck or Edit Below the Record

The island recomputes `detectPrsInSequence` from the original baseline on every set change. Unchecking set 5 or lowering it to 80 × 5 removes its badges; no toast fires on removal (FR-PR-009).

## Edge Case: Warm-up Set

A `warmup` set never produces a badge and never raises the baseline.

## Edge Case: Exercise Added Mid-Workout

The island calls `GET /api/progress/baselines?exerciseIds=<id>&workoutId=<id>` and adds the baseline to its state. Offline: no baseline → no badges for that exercise until the next online load; the summary still shows the PRs after sync.

## Edge Case: Editing a Past Workout

Edit mode (FR-WT-039) loads baselines with `{ excludeWorkoutId, completedBefore: workout.completedAt }`, so only earlier workouts compete. After saving, every record re-derives (no stored state, ADR-020 §4).

## Edge Case: Deload Workout

PRs still count during a deload (ADR-021 §6).

## Failure: Baseline Endpoint Unavailable

`GET /api/progress/baselines` fails (5xx or offline) → the exercise has no baseline; the island shows no badges for it and does not retry. Server-side PR lists are unaffected.
