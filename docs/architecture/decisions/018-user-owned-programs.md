---
id: ADR-018
title: User-Owned Programs and Routines (supersedes ADR-003)
type: decision
status: accepted
date: 2026-10-01
---

# ADR-018: User-Owned Programs and Routines (supersedes ADR-003)

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted. **Supersedes [ADR-003](./003-routines-seed-data.md)** ("Users CANNOT create or modify routines").

## Context

Phase 1 has two global seeded routines (`hombre`, `mujer`). The user's routine is chosen by `profiles.routine_type`. Hevy's core feature is a routine builder: users create routines, group them in folders, and copy routines from a template library. Gravl assigns a plan built for the user. Both models need user-owned, editable plans.

The existing tables already have the right three-level shape:

```
routines (program) 1─* routine_days (routine / workout template) 1─* routine_exercises
```

## Decision

### 1. Vocabulary (UI + docs)

| Table | Domain term | Hevy equivalent | UI copy (es) |
|---|---|---|---|
| `routines` | **Program** | Folder | "Programa" |
| `routine_days` | **Routine** | Routine | "Rutina" |
| `routine_exercises` | **Routine exercise** | Routine exercise | "Ejercicio" |

Table names stay unchanged to avoid churning Phase 1 FKs (`workouts.routine_day_id`).

### 2. Ownership

- `routines.owner_id` is nullable. `NULL` means a **template** (seeded, read-all, immutable).
- A user **adopts** a template by deep-copying it (program, routines, routine exercises) into rows they own, with `source_template_id` pointing back. Edits never touch the template.
- A user may also create a program from scratch, and may own several programs. One of them is **active**: `profiles.active_program_id`.
- User programs are **read-all** (siblings can see and copy them, as in Hevy's "copy routine") and **write-own**, per [ADR-004](./004-rls-visibility.md).

### 3. New / changed columns

| Table | Change |
|---|---|
| `routines` | `type` becomes nullable (kept as a template tag); add `owner_id`, `source_template_id`, `description`, `is_template`, `level` (`beginner`/`intermediate`/`advanced`), `goal` (`strength`/`hypertrophy`/`general`), `days_per_week`, `equipment_profile` (`full_gym`/`dumbbells`/`bodyweight`), `focus` (`balanced`/`glutes_legs`/`upper_body`), `is_archived`, `created_at`, `updated_at` |
| `routine_days` | `day_number` now means **position in the rotation** (1..14), no longer weekday; add `notes`. `day_name` becomes the routine's name ("Push A"). `focus` stays as a subtitle |
| `routine_exercises` | add `target_reps_min`, `target_reps_max` (`target_reps` kept as legacy = max), `warmup_sets` (default 0), `rest_seconds` (NULL = user default), `superset_group`, `target_rpe` NULL, `notes` |
| `profiles` | add `active_program_id` (FK `routines.id`, nullable). `routine_type` kept only as an onboarding hint |

### 4. Migration of existing users

For each profile: adopt the template matching `routine_type` (`hombre` → "Male 5-Day Split", `mujer` → "Female Glute Focus 5-Day") and set `active_program_id`. Phase 1 workouts keep pointing to the **template** `routine_days`, because history is immutable. New workouts point to the user's copy.

### 5. Limits

| Rule | Value |
|---|---|
| Programs per user | 20 |
| Routines per program | 14 |
| Exercises per routine | 30 (matches `MaxExercises`, [ADR-016](./016-workout-data-model-v2.md)) |
| Target sets per exercise | 1–20 |
| Rep range | 1 ≤ min ≤ max ≤ 100 |

## Rationale

- Copy-on-adopt keeps templates stable and user edits isolated (Hevy "Save routine" from explore).
- Reusing the three existing tables avoids a breaking FK migration on `workouts`.

## Trade-offs

- **Pro:** No change to `workouts.routine_day_id` semantics.
- **Con:** "routines = programs" is confusing at the table level. Mitigated by the vocabulary table and the glossary.
- **Con:** Deep copies duplicate rows. Negligible at family scale.

## Consequences

- New context `routines` ([context](../contexts/routines/readme.md), [PRD](../../prd/features/routines.md)). Routine data access moves out of `workout-tracking` (`routine.repository.ts`) into `routines`. `workout-tracking` consumes it through a `RoutinePlanPort`.
- ADR-003 status → *Superseded by ADR-018*.
- RLS: `routines`, `routine_days`, `routine_exercises` get `insert/update/delete_own` policies via `routines.owner_id = auth.uid()`. Templates (`owner_id IS NULL`) are not writable by any client.
- Template seeds: [database-schema.md → Program Templates Seed](../database-schema.md#program-templates-seed).

## Referenced by

- [routines PRD](../../prd/features/routines.md)
- [ADR-019](./019-rotation-scheduling-and-onboarding.md)
- [database-schema.md](../database-schema.md)
