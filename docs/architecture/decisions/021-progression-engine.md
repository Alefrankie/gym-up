---
id: ADR-021
title: Progression Engine — Deterministic Double Progression, Plateau Detection, Deload
type: decision
status: accepted
date: 2026-10-01
---

# ADR-021: Progression Engine — Deterministic Double Progression, Plateau Detection, Deload

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted

## Context

Gravl tells the user what to lift next session, adapts when they stall, and schedules lighter weeks. Hevy only shows "Previous". Our users are beginners who ask "¿cuánto subo hoy?". We need suggestions that are safe, explainable and testable, without an AI dependency in the hot path.

## Decision

The progression engine is a **pure domain module** in a new `progression` context ([context](../contexts/progression/readme.md)). Its inputs are the user's history and settings; its output is a suggestion per exercise. No AI. All rules are unit-tested with Object Mothers ([ADR-009](./009-object-mothers.md)).

### 1. Exposure

An **exposure** is one completed workout containing ≥ 1 completed working set (`set_type ∈ {normal, failure}`) of the exercise. Drop sets and warm-ups are ignored. The engine looks at the last 3 exposures.

### 2. Target rep range

1. If the workout comes from a routine: `[target_reps_min, target_reps_max]` from `routine_exercises`.
2. If it is a free workout: the user's default for the exercise's equipment from `ProgressionDefaults.RepRange` (compound barbell `[5, 8]`, everything else `[8, 12]`).

### 3. Double progression (per exercise, before each session)

Let `last` be the most recent exposure, `W` its top working weight (the most common weight across its working sets) and `sets` its working sets at `W`.

| Condition on `last` | Suggestion |
|---|---|
| **All** working sets at `W` reached `≥ max` reps and no set had `rpe ≥ 9.5` | **Increase**: weight = `W + increment`, reps = `min` |
| All sets reached `≥ min` reps (but not all reached `max`) | **Hold**: weight = `W`, reps = best reps of `last` + 1 (capped at `max`) |
| Any set `< min` reps, and the exposure before `last` also missed `min` at the same `W` | **Reduce**: weight = `W × 0.9` (rounded), reps = `min` |
| Any set `< min` reps (first miss) | **Hold**: weight = `W`, reps = `min` |
| No exposure | No suggestion (see [ADR-019 §4](./019-rotation-scheduling-and-onboarding.md)) |

For rep-only types (`bodyweight_reps`, `assisted_bodyweight`): increase reps by 1 per set until `max`. Then suggest adding load (`weighted_bodyweight`) or reducing assistance by one increment. Duration types: +5 s per session. Distance types: no suggestion.

### 4. Increments (kg), by equipment and muscle

| Equipment | Lower body (quadriceps, hamstrings, glutes, adductors, abductors, calves) | Upper body / other |
|---|---|---|
| `barbell`, `smith_machine` | 5.0 | 2.5 |
| `dumbbell` (per dumbbell) | 2.0 | 2.0 (1.0 when W < 10) |
| `machine`, `cable` | 5.0 | 2.5 |
| `kettlebell` | 4.0 | 4.0 |
| `plate`, `band`, `other`, `weighted_bodyweight` | 2.5 | 2.5 |

**lbs users** get unit-native steps; suggestions are rounded in display units: barbell 10 / 5 lb, dumbbell 5 lb, machine/cable 10 / 5 lb, kettlebell 9 lb, other 5 lb.

**Rounding** to loadable weights: barbell suggestions round **down** to a multiple of `2 × smallest available plate` above the bar, using the user's plate settings ([PRD FR-WT-037](../../prd/features/workout-tracking.md)). Other equipment rounds to the nearest increment step.

**Safety caps** from `HealthRules`: an increase never exceeds `MaxWeightIncreasePerSessionKg` (5 kg) or 10 % of `W`, whichever is smaller (minimum one increment step).

### 5. Plateau detection

An exercise is **plateaued** when the best e1RM ([ADR-020](./020-personal-records.md)) has not improved over the last **3 exposures** relative to the best e1RM before them, *and* the exercise has ≥ 4 exposures. For rep-only types the metric is best reps.

The plateau response is shown to the user, who decides:

1. **"Bajar y reconstruir"** (default): next session weight × 0.9, then normal double progression.
2. **"Cambiar rango"**: switch the rep range for 4 weeks (`[5,8] ↔ [8,12]`), stored as `exercise_progression_overrides`.
3. **"Ignorar"**: dismiss for 2 exposures.

### 6. Deload (program-wide)

A deload week is **suggested** (never forced) when either:

- ≥ 6 weeks since the last deload (or since the first workout of the active program) **and** ≥ 3 exercises of the active program are plateaued, **or**
- ≥ 8 weeks since the last deload.

When the user accepts, `profiles.deload_until = today + 7 days`. Every workout started before that date has `is_deload = true` and its suggestions become:

- sets: `max(1, round(target_sets × 0.6))`;
- weight: `W × 0.9`, rounded;
- reps: `min` of the range.

PRs still count during a deload. Deload workouts are excluded from the plateau window.

### 7. Settings

`profiles.progression_enabled` (default true). When disabled, the island shows only "Previous" (pure Hevy mode).

## Rationale

- Double progression is the standard beginner/intermediate scheme (used by Gravl-like apps and most coaching programs). It needs only reps and weight.
- Deterministic rules are explainable in the UI ("Subimos 2.5 kg porque hiciste 12/12/12").
- The safety caps reuse the Phase 1 `HealthRules`, so the spirit of the Phase 1 rules survives as suggestion limits.

## Trade-offs

- **Pro:** Zero cost, offline-capable (suggestions are computed server-side at load and shipped in the island props), fully testable.
- **Con:** Less adaptive than ML coaching. The weekly AI summary ([ADR-026](./026-weekly-ai-coach-summary.md)) covers the "coach voice".

## Consequences

- Tables: `exercise_progression_overrides(user_id, exercise_id, rep_min, rep_max, range_until, dismissed_until_exposures, rebuild_pending)` (owner-only); `profiles.deload_until`, `profiles.last_deload_at`, `profiles.deload_snoozed_until`, `profiles.progression_enabled`. DDL: [database-schema.md → 007](../database-schema.md#007--progression-adr-021-adr-022).
- Every suggestion carries a `reason` code (`increase_all_sets_hit_max`, `hold_progressing`, `reduce_two_misses`, `deload`, `readiness_low`, `plateau_rebuild`) rendered by the UI with i18n strings.
- The readiness adjustments ([ADR-022](./022-readiness-and-recovery.md)) apply **after** the progression output.

## Referenced by

- [progression PRD](../../prd/features/progression.md)
- [progression context](../contexts/progression/readme.md)
