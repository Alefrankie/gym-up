---
id: ADR-020
title: Personal Records — Definitions, Epley 1RM, Computed On Demand
type: decision
status: accepted
date: 2026-10-01
---

# ADR-020: Personal Records — Definitions, Epley 1RM, Computed On Demand

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted

## Context

Hevy celebrates personal records (PRs) live during the workout, lists them in the workout summary and the feed, and keeps a records table per exercise. We need to settle which record types exist, how the estimated 1RM is computed, which sets count, and whether records are stored or derived.

## Decision

### 1. Record types (Hevy set)

Per exercise, per user. Only sets with `completed = true` and `set_type ≠ 'warmup'` count ([ADR-016](./016-workout-data-model-v2.md)).

| Record | Key | Applies to `exercise_type` | Formula |
|---|---|---|---|
| `heaviest_weight` | Heaviest weight | `weight_reps`, `weighted_bodyweight`, `weight_distance` | max(weight) |
| `best_1rm` | Best estimated 1RM | `weight_reps`, `weighted_bodyweight` | max(e1RM(weight, reps)) |
| `best_set_volume` | Best set volume | `weight_reps`, `weighted_bodyweight` | max(weight × reps) |
| `best_session_volume` | Best session volume | `weight_reps`, `weighted_bodyweight` | max over workouts of Σ(weight × reps) for that exercise |
| `most_reps` | Most reps in one set | `bodyweight_reps`, `assisted_bodyweight`, `weighted_bodyweight` | max(reps) |
| `least_assistance` | Least assistance | `assisted_bodyweight` | min(abs(weight)) with reps ≥ 1 |
| `longest_duration` | Longest duration | `duration`, `distance_duration` | max(duration_seconds) |
| `longest_distance` | Longest distance | `distance_duration`, `weight_distance` | max(distance_m) |
| `best_pace` | Best pace | `distance_duration` with distance ≥ 400 m | min(duration_seconds / distance_m) |
| `rep_max` | Best weight for N reps (the "rep records" table) | `weight_reps` | for each reps N ∈ 1..12: max(weight) where reps ≥ N |

### 2. Estimated 1RM

**Epley**: `e1RM = weight × (1 + reps / 30)`. When reps = 1, e1RM = weight.

- e1RM is computed only for `1 ≤ reps ≤ 12`. Above 12 reps the estimate is unreliable, so those sets do not compete for `best_1rm`.
- Values are rounded to 0.5 kg for display only. Comparisons use full precision.

### 3. When is a set a PR?

A set *S* in workout *W* is a PR for record type *R* when its value strictly beats the best value across **all completed workouts before W** (by `completed_at`) plus the earlier sets of W itself.

- Ties are not PRs.
- The **first ever** exposure to an exercise produces no PR badges (Hevy behaviour). Otherwise every first session would be all PRs.
- A set can hold several PRs at once (e.g. heaviest weight and best 1RM).

### 4. Computed on demand, not stored

Records are derived from `workout_entries`. There is no `personal_records` table.

- The live workout gets a **baseline** per exercise when the workout loads: the current best for each record type, excluding this workout. The client checks each completed set against the baseline and updates it locally (instant badge, works offline per [ADR-025](./025-offline-live-workout.md)).
- The summary, the exercise records page and the feed card recompute through `GetPersonalRecordsUseCase` / `GetWorkoutPrsUseCase`.
- Editing or deleting a past workout automatically re-derives every record. There is no stale state.

## Rationale

- Family scale: at most a few thousand sets per user per year, so aggregation is cheap (indexed on `exercise_id` and `workouts(user_id, status)`).
- Derivation avoids every cache-invalidation bug that a stored table would bring after edits and deletes (Hevy itself recalculates records after edits).

## Trade-offs

- **Pro:** Always correct; zero schema.
- **Con:** Each records page recomputes. If p95 goes above 300 ms, add a materialized cache (see the NFR in the [progress PRD](../../prd/features/progress.md)).

## Consequences

- Domain: `src/lib/contexts/progress/domain/personal-records.ts`, a pure module exposing `e1rm()`, `computeRecords(sets)` and `detectPrs(baseline, set)`.
- Shared constant `RecordRules = { E1rmMaxReps: 12, RepMaxTableMax: 12, PaceMinDistanceM: 400 }`.
- `detectPrs` is the same pure module used by the island (bundled client-side) and the server, so one implementation serves both.

## Referenced by

- [progress PRD](../../prd/features/progress.md)
- [progress context](../contexts/progress/readme.md)
- [ADR-021](./021-progression-engine.md)
