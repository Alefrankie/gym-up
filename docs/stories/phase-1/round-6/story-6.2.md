---
story_id: "6.2"
round: "round-6"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "L"
status: "completed"
started: "2026-08-26"
completed: "2026-08-27"
owner: "crew-flow"
implements:
  architecture_features: ["workout-tracking", "progress", "public-view", "private-photos"]
  architecture_decisions: ["ADR-001", "ADR-004", "ADR-005", "ADR-006", "ADR-007", "ADR-010"]
  flows: []
blocked_by: ["story-6.1"]
blocks: ["story-6.3"]
---

# Story 6.2 — `SupabaseXxxRepository` Implementations + RLS

Parent: [../readme.md](../readme.md)

## Summary

Add a `SupabaseXxxRepository` concrete class for every abstract repository from Round 1, and move the visibility / ownership rules from the repository layer down to RLS policies on Postgres. Components keep calling the same `XxxRepository` contract — only the composition root swaps the concrete class.

## Happy Path

1. Add `src/lib/supabase/client.ts` (Supabase client init, env-driven).
2. For each `SqliteXxxRepository` from Round 1, add a `SupabaseXxxRepository` with the **same public method signatures**. Internals call the Supabase client; they no longer inject `where userId = ?` clauses (RLS handles that).
3. Add RLS policies to the migration from 6.1:
   - `profiles`, `workouts`, `workout_entries`: write-own / read-all per [ADR-004](../../architecture/decisions/004-rls-visibility.md).
   - `progress_photos` rows + storage objects: owner-only per [ADR-005](../../architecture/decisions/005-private-photos.md).
   - `routines`, `routine_days`, `routine_exercises`, `exercises`: read-all (no write from clients).
4. Update the per-context composition root ([ADR-010](../../architecture/decisions/010-per-context-composition.md)) to read `STORAGE_BACKEND` and wire the `SupabaseXxxRepository` (or `SqliteXxxRepository` for local dev).
5. Add integration tests that hit Supabase as a non-owner user and assert visibility rules are enforced (RLS rejects unauthorized reads; repo throws on unauthorized writes).

## Acceptance Criteria

- AC-6.2-01: A `SupabaseXxxRepository` exists for every `XxxRepository` abstract class used in Rounds 1–5, with identical public method signatures.
- AC-6.2-02: RLS policies enforce write-own / read-all per [ADR-004](../../architecture/decisions/004-rls-visibility.md). Integration test as a non-owner fails to read another user's workout and fails to write to it.
- AC-6.2-03: RLS policies on `progress_photos` rows enforce owner-only per [ADR-005](../../architecture/decisions/005-private-photos.md). Integration test as a non-owner fails to read or delete another user's photo row.
- AC-6.2-04: Per-context composition root ([ADR-010](../../architecture/decisions/010-per-context-composition.md)) selects the right concrete based on `STORAGE_BACKEND` with no other code change.
- AC-6.2-05: Switching `STORAGE_BACKEND=sqlite` ↔ `STORAGE_BACKEND=supabase` requires no change in components or pages.

## Repositories to port (non-exhaustive — covers the ones created in Rounds 1–4)

| Abstract | Supabase concrete | Notes |
|----------|-------------------|-------|
| `ProfileRepository` | `SupabaseProfileRepository` | public read on `display_name`; write-own on `routine_type`, `weight_unit` |
| `RoutineRepository` | `SupabaseRoutineRepository` | read-only for clients; seed-only writes |
| `WorkoutRepository` | `SupabaseWorkoutRepository` | write-own on `workouts` and `workout_entries`; read-all |
| `PhotoRepository` | `SupabasePhotoRepository` | owner-only row access; storage object access in story 6.3 |

## Tasks

- [x] `T6.2-01` - Create `src/lib/supabase/client.ts`
- [x] `T6.2-02` - Implement `SupabaseProfileRepository`
- [x] `T6.2-03` - Implement `SupabaseRoutineRepository`
- [x] `T6.2-04` - Implement `SupabaseWorkoutRepository`
- [x] `T6.2-05` - Implement `SupabasePhotoRepository` (row-level; storage in 6.3)
- [x] `T6.2-06` - Add RLS policies to the migration (`profiles`, `workouts`, `workout_entries`, `progress_photos`)
- [x] `T6.2-07` - Update per-context composition root to branch on `STORAGE_BACKEND`
- [x] `T6.2-08` - Integration test: non-owner cannot read/write another user's workout
- [x] `T6.2-09` - Integration test: non-owner cannot read/delete another user's photo row
- [x] `T6.2-10` - Regression test: `STORAGE_BACKEND=sqlite` still boots the app and passes local unit tests
