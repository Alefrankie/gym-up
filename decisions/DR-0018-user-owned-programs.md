---
id: DR-0018
title: "User-Owned Programs and Routines (supersedes ADR-003)"
status: implemented
tier: 2
date: 2026-10-01
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: cross-team
reversibility: costly
risk_flags: [data]

depends_on: []
supersedes: [DR-0003]
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/api/src/lib/contexts/routines/"
    - "apps/app/src/routes/programs/"
  issues: []
  prs: []

validation:
  criteria:
    - "Templates are immutable; adopting one deep-copies it into user-owned rows"
    - "Users can create and edit their own programs and routines"
  review_by: null
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-018
---
# DR-0018 · User-Owned Programs and Routines (supersedes ADR-003)

## Legacy status

Accepted. **Supersedes [ADR-003](./DR-0003-routines-seed-data.md)** ("Users CANNOT create or modify routines").

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
- User programs are **read-all** (siblings can see and copy them, as in Hevy's "copy routine") and **write-own**, per [ADR-004](./DR-0004-rls-visibility.md).

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
| Exercises per routine | 30 (matches `MaxExercises`, [ADR-016](./DR-0016-workout-data-model-v2.md)) |
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

- New context `routines` ([context](../docs/architecture/contexts/routines/readme.md), [PRD](../docs/prd/features/routines.md)). Routine data access moves out of `workout-tracking` (`routine.repository.ts`) into `routines`. `workout-tracking` consumes it through a `RoutinePlanPort`.
- ADR-003 status → *Superseded by ADR-018*.
- RLS: `routines`, `routine_days`, `routine_exercises` get `insert/update/delete_own` policies via `routines.owner_id = auth.uid()`. Templates (`owner_id IS NULL`) are not writable by any client.
- Template seeds: [database-schema.md → Program Templates Seed](../docs/architecture/database-schema.md#program-templates-seed).

## Implementation notes (2026-10-29)

Implemented in `apps/api` (context `routines`, endpoints `/programs`, `/workouts/today`) and `apps/app` (`/programs`, `/programs/[id]`). Choices made while implementing:

- `routines.type` stays NOT NULL (SQLite cannot relax it): user programs and the three new templates use the value `neutral`; the two legacy templates keep `hombre`/`mujer`, which is how a user without a program gets a starting template.
- A user without an active program gets the template matching their profile type adopted lazily the first time `/workouts/today` is requested.
- `/workouts/today` returns the next routine in the active program's rotation (the one after the last completed workout, wrapping around). A workout already started or finished today pins the card to its routine. The `rest_day` response is no longer produced.
- Saving a program is `PUT /programs/:id` with the whole structure: routines and exercises are upserted by id and the rest are deleted, as separate idempotent statements (D1 has no interactive transactions). A routine that already has workouts cannot be removed (`400`); archive the program instead.
- Seeded templates: the two legacy 5-day routines plus Full Body 3-Day, Upper / Lower 4-Day and Push / Pull / Legs. Superset groups, RPE targets, `equipment_profile` and `focus` columns are not implemented yet.

## Referenced by

- [routines PRD](../docs/prd/features/routines.md)
- [ADR-019](./DR-0019-rotation-scheduling-and-onboarding.md)
- [database-schema.md](../docs/architecture/database-schema.md)

## Log

- 2026-10-01 accepted as ADR-018 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/018-user-owned-programs.md; status mapped to the code as of today: implemented. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet.
- 2026-11-04 note: Implementation detail (RLS, Supabase) superseded by DR-0027.
