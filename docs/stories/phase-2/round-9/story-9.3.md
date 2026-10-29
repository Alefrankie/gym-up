---
story_id: "9.3"
round: "round-9"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking", "routines", "progress"]
  prd_requirements: ["FR-WT-035", "FR-WT-036", "FR-WT-039", "FR-RT-018", "FR-PR-018"]
  architecture_decisions: ["ADR-016"]
  flows: ["finish-workout.flow.md", "edit-workout.flow.md"]
blocked_by: ["story-9.2"]
blocks: ["story-10.1", "story-12.1", "story-12.3"]
---

# Story 9.3 — Finish, summary v2, edit/delete, save as routine, history v2

Parent: [../readme.md](../readme.md)

## Summary

Closes the loop of a session: *Terminar* with the unchecked-sets and "¿Olvidaste terminar?" dialogs, `FinishWorkoutUseCase`, the v2 summary, edit mode for completed workouts, delete, the *Repetir* button, *Guardar como rutina* (routines' `SaveWorkoutAsRoutineUseCase` over the `WorkoutSnapshotPort` that workout-tracking provides), history v2 and the owner detail page `/workouts/[id]`. The PR list and PR-count column render nothing until story 10.1 ([phase rule 7](../readme.md#7-forward-compatible-ui)). Closes Hevy rows H10 and H15 and the *Repetir* half of H1.

## Files in scope

**Modify**

- `src/components/live-workout/live-workout.reducer.ts`, `live-workout.commands.ts`, `use-live-workout.ts`, `workout-header.tsx`, `live-workout.tsx`, `sync/sync-worker.ts` — `workout/finished`, `workout/times-edited`, `edit/cancelled`, `pendingEditCommands`, `Terminar` / `Guardar` / `Cancelar`, editable start/end in edit mode, `flush()`.
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` (+ SQLite and Supabase implementations) — add `finish`, `findPreviousCompletedByRoutineDay`; `update` with `UpsertResult` and LWW; `getHistoryByUser` with filter and the v2 `WorkoutHistoryItem`.
- `src/lib/contexts/workout-tracking/application/get-live-workout-state.use-case.ts` — add the `mode: 'edit'` branch (owner, `completed`, no suggestions, no timer).
- `src/lib/contexts/workout-tracking/application/get-workout-history.use-case.ts` — v2 items and filters.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts`.
- `src/pages/history.astro` — history v2; `src/pages/workout/[id].astro` — completed → summary v2, `?mode=edit`, non-owner redirect to `/workouts/[id]`.
- `src/pages/api/workouts/[id].ts` — add `PATCH`; `DELETE` also handles completed workouts.
- `src/lib/contexts/routines/routines.composition.ts` — consume `workoutSnapshotPort`.

**Create**

- Domain: `src/lib/contexts/workout-tracking/domain/finish-plan.ts` (`planFinish`, `hasValues`), `src/lib/contexts/workout-tracking/domain/ports/workout-snapshot.port.ts`; `src/lib/contexts/routines/domain/routine-from-workout.ts` (`deriveRoutineFromWorkout`).
- Application (workout-tracking): `finish-workout.use-case.ts`, `get-workout-summary.use-case.ts`, `update-completed-workout.use-case.ts`, `delete-workout.use-case.ts`, `workout-snapshot.adapter.ts`, `workout-snapshot.instance.ts` and `infrastructure/workout-repository.factory.ts` (the instance builds only the adapter and its repository, to avoid a cycle with routines); (routines) `save-workout-as-routine.use-case.ts`.
- API: `src/pages/api/workouts/[id]/finish.ts` (POST), `src/pages/api/workouts/[id]/save-as-routine.ts` (POST).
- Pages and components: `src/pages/workouts/[id].astro` (owner detail), `src/components/live-workout/finish-dialog.tsx`, `src/components/workout-summary/workout-summary.tsx`, `src/components/workout-detail/workout-detail-actions.tsx` (*Editar*, *Repetir* via `StartWorkoutButton`, *Eliminar*), `src/components/history/history-list.astro`; reuses `ProgramDestinationDialog` from 8.2 for the destination choice.
- Tests: see [Test Plan](#test-plan).

**Delete**

- `src/components/workout-summary.astro`, `src/pages/api/workouts/[id]/complete.ts`, `src/lib/contexts/workout-tracking/application/complete-workout.use-case.ts`, `tests/workout-tracking/complete-workout.use-case.test.ts`.
- Phase 1 repository methods and `GetWorkoutDetailUseCase` whose last caller disappears with the history rewrite (`findByUserAndDate`, `findEntries`, `getEntriesWithExercises`): grep first, delete only unreferenced ones.

**Not in scope** (must not change): `db/`, `supabase/migrations/` (RPC `finish_workout` ships in 7.1); `src/pages/family/[user_id].astro`; the social parts of the detail page (likes, comments, activity) and `ShareImageButton`.

## Decisions

- `planFinish` is a pure domain function used by **both** the reducer and `FinishWorkoutUseCase`, so client and server totals agree. A set "has values" when `reps`, `durationSeconds` or `distanceM` is non-null or `weight ≠ 0` (RPE alone is not a value).
- A blank workout name on finish or `PATCH` keeps the stored name (already the routine name or "Entrenamiento libre"); names over 60 characters return `400`.
- Round 9 has no durable outbox, so *Terminar* awaits `syncWorker.flush()` (all pending commands acked, new method on the worker) before navigating to `/workout/[id]`; on failure it stays in the island with a retry button. 12.3 replaces this with the "pendiente de sincronizar" screen.
- Edit mode resolves unchecked sets **client-side**: *Guardar* with unchecked rows that have values shows the same "Tienes N series sin marcar" step (no duration step), and the reducer turns the result into explicit `upsert-set` / `delete-set` / `remove-exercise` commands in `pendingEditCommands`, because `UpdateCompletedWorkoutUseCase` does not know about unchecked sets.
- History v2 stays in workout-tracking (`GetWorkoutHistoryUseCase`, `WorkoutRepository.getHistoryByUser`), not in progress' `GetHistoryUseCase` of the progress readme, because that one needs the stats stack, `BodyWeightPort` (11.1) and `PrCountPort` (10.1). It keeps Phase 1 behaviour: completed and in-progress workouts, an "En curso" badge (the row links to `/workout/[id]`), 20 per page. Volume is `Σ max(0, weight) × reps` of completed sets. Phase 1 workouts have `program_id = NULL`, so they appear only under "Todos" when filtering by program (routine filter still works).
- Program and routine filters are two GET selects (`?program=`, `?routine=`) fed by routines' `ListProgramsUseCase`.
- `/workouts/[id]` is read-only and owner-only in this story; a non-owner is redirected to `/family/[ownerId]` until story 12.1 opens it to the family with likes and comments. *Añadir foto* links to `/photos?workout=[id]`; *Compartir* is hidden until 12.2.
- `SaveWorkoutAsRoutineUseCase` errors follow the routines readme: `404` missing, `403` another user's workout, `400` not savable (`not_completed`, `empty`).

## Happy Path

1. User taps *Terminar*. `FinishDialog` computes from island state: completed sets, unchecked sets with values, elapsed ([FR-WT-035](../../../prd/features/workout-tracking.md#fr-wt-035)).
2. Unchecked rows with values: "Tienes N series sin marcar", **Marcarlas como hechas** / **Descartarlas**. Rows without values are dropped silently. Elapsed > 180 min: "¿Olvidaste terminar?" with an editable end time (default: the last completed set's time).
3. The reducer applies `planFinish` locally and emits `finish-workout`; the worker sends `POST /api/workouts/[id]/finish`. `FinishWorkoutUseCase` builds the `FinishPlan`, requires ≥ 1 completed set and valid times, and `workoutRepository.finish` completes the workout in one transaction.
4. After `flush()` the island navigates to `/workout/[id]`: `WorkoutSummary` v2 shows duration, volume, sets, top 5 muscles and the volume Δ % vs the previous workout of the same routine ([FR-WT-036](../../../prd/features/workout-tracking.md#fr-wt-036)).
5. User renames the workout and edits notes inline (`PATCH /api/workouts/[id]` on blur), taps *Guardar como rutina*, picks a destination in `ProgramDestinationDialog` and gets a new routine ([FR-RT-018](../../../prd/features/routines.md#fr-rt-018)).
6. *Listo* returns to `/dashboard`; the rotation now points to the next routine.
7. Later, from `/history` the user opens a workout at `/workouts/[id]` and taps *Editar*: `/workout/[id]?mode=edit` mounts the island in edit mode ([FR-WT-039](../../../prd/features/workout-tracking.md#fr-wt-039)). Changes accumulate in `pendingEditCommands`; *Guardar* enqueues them followed by `finish-workout { mode: 'edit' }` and returns to the summary.
8. *Eliminar* with confirmation deletes the workout and lands on `/history`; *Repetir* starts a new workout from it ([FR-WT-018](../../../prd/features/workout-tracking.md#fr-wt-018) mode 4).

## Acceptance Criteria

- AC-9.3-01: `FinishDialog` runs locally: unchecked rows with values show "Tienes N series sin marcar" (**Marcarlas como hechas** / **Descartarlas**); rows without values are discarded silently and never mentioned; elapsed > 180 min shows "¿Olvidaste terminar?" with an editable end time defaulting to the last completed set; an end time before `startedAt` is rejected in the dialog. Zero completed sets shows "Registra al menos una serie" with **Seguir entrenando** and **Descartar entrenamiento** ([FR-WT-035](../../../prd/features/workout-tracking.md#fr-wt-035)).
- AC-9.3-02: `planFinish` table tests: `complete` marks valid unchecked sets completed at `completedAt`; invalid unchecked sets are removed under both resolutions; empty sets are removed; exercises left with no sets are removed. The reducer and `FinishWorkoutUseCase` produce identical totals for the same input.
- AC-9.3-03: `POST /api/workouts/[id]/finish` (`mode: 'live'`) completes the workout atomically (`status`, `completedAt`, `name`, `notes`, removals and completions in one transaction). No completed set returns `422 no_completed_sets` and leaves the workout `in_progress` with every row untouched. `startedAt ≤ completedAt ≤ now + 5 min` else `400 invalid_times`. A replay returns `200 replayed` with no change. Another user's workout returns `403`, unknown `404`.
- AC-9.3-04: A 10-minute workout with one exercise and one completed set finishes normally (no minimum duration or exercise count, [ADR-016 §5](../../../architecture/decisions/016-workout-data-model-v2.md)).
- AC-9.3-05: After *Terminar* the island waits for `flush()` and then navigates to `/workout/[id]`; if a command fails it stays on the page with an error and a retry button, and the workout remains `in_progress` on the server.
- AC-9.3-06: `GetWorkoutSummaryUseCase` returns duration (`completedAt − startedAt`), volume `Σ max(0, weight) × reps` of completed sets, completed sets, top 5 muscles by working sets (primary 1, secondary 0.5, warm-ups excluded) and `previousComparison { workoutId, volumeDeltaPct }` against `findPreviousCompletedByRoutineDay` (`null` for empty workouts or no previous one). Worked-example tests cover each. `WorkoutSummary` shows 2 × 2 tiles at 360 px; the *Récords* tile and the PR list are hidden while the PR list is empty.
- AC-9.3-07: Name and notes edit inline and save with `PATCH /api/workouts/[id]` on blur (`UpdateCompletedWorkoutUseCase`, LWW by `updatedAt`); a blank name keeps the stored one, over 60 chars returns `400`, another user returns `403`.
- AC-9.3-08: `/workout/[id]?mode=edit` for the owner of a completed workout mounts the island in edit mode: no clock, no timer, no suggestions, *Anterior* only, editable name, notes, start date/time and duration, buttons *Guardar* / *Cancelar*. An `in_progress` workout with `?mode=edit` redirects to the live view; a non-owner is redirected to `/workouts/[id]`.
- AC-9.3-09: In edit mode every command is held in `pendingEditCommands` and nothing reaches the server until *Guardar*. *Cancelar* (with "¿Descartar cambios?" when commands are pending) drops them and returns to `/workouts/[id]`. *Guardar* enqueues the held commands in order, then `finish-workout { mode: 'edit', startedAt, completedAt, name, notes }` → `UpdateCompletedWorkoutUseCase`, which validates the times, recomputes `workoutDate` in `profiles.timezone` and applies LWW.
- AC-9.3-10: Edit-mode failures: leaving zero completed sets shows "Registra al menos una serie" with **Eliminar entrenamiento** and sends nothing; a future start or a duration that puts `completedAt` after `now + 5 min` shows "Revisa la fecha y la duración", disables *Guardar*, and the server answers `400` for the same input; unchecked rows with values follow the decision above.
- AC-9.3-11: Editing a completed workout (add a set, change a weight) is reflected by `/history` volume and the Phase 1 `/progress` chart for that exercise (AC-R9-04); a Phase 1 workout can be edited like any other.
- AC-9.3-12: `DELETE /api/workouts/[id]` on an own completed workout confirms, deletes it with all children (FK cascade) and lands on `/history`, where it no longer appears; another user's workout returns `403`, unknown `404`. `DeleteWorkoutUseCase` rejects an `in_progress` workout with `422 workout_not_completed`.
- AC-9.3-13: *Repetir* appears only on the owner's own completed workouts and starts mode `repeat` through `StartWorkoutButton`, including the **Continuar el actual** / **Descartar y empezar nuevo** choice. It is never rendered for other users' workouts.
- AC-9.3-14: *Guardar como rutina* is shown only when the workout has ≥ 1 completed working set. `POST /api/workouts/[id]/save-as-routine` (`{ programId }` or `{ newProgramName }`) returns `201 { routine, skippedExercises }`. `deriveRoutineFromWorkout` follows the routines readme (warm-ups excluded from target sets, rep range widened to at least 2 apart, cap 100, distance types → no range, a superset left with one member dissolves). Another user's workout returns `403`; missing `404`; not completed or empty `400`. `WorkoutSnapshotAdapter` returns live rows only and `undefined` for missing or in-progress workouts.
- AC-9.3-15: History v2 at `/history` lists name, date, duration, volume and sets per workout, 20 per page, links to `/workouts/[id]` ("En curso" rows link to `/workout/[id]`), filters by program and routine; no PR-count column until 10.1 ([FR-PR-018](../../../prd/features/progress.md#fr-pr-018)). Phase 1 fixture totals (count, volume per workout) are unchanged.
- AC-9.3-16: `/workouts/[id]` shows, for the owner, header stats, every exercise with all sets (labels `W`/`D`/`F`/ordinals), notes, and *Editar*, *Repetir*, *Eliminar*; a non-owner is redirected to `/family/[ownerId]`; unknown id `404`.
- AC-9.3-17: Both backends pass the same use-case and repository tests. Supabase: as a non-owner, `finish_workout`, `PATCH` and `DELETE` on another user's workout fail ([ADR-004](../../../architecture/decisions/004-rls-visibility.md)). `complete-workout.use-case.ts`, `POST /api/workouts/[id]/complete`, `workout-summary.astro` and their tests no longer exist and nothing imports them.

## Tasks

- [ ] `T9.3-01` - Pure `finish-plan.ts` (`planFinish`, `hasValues`) with table tests
- [ ] `T9.3-02` - `WorkoutRepository`: `finish`, `findPreviousCompletedByRoutineDay`, LWW `update`, `getHistoryByUser` filter and v2 `WorkoutHistoryItem` (abstract class, SQLite, Supabase via `finish_workout`)
- [ ] `T9.3-03` - Use cases `FinishWorkoutUseCase`, `GetWorkoutSummaryUseCase`, `UpdateCompletedWorkoutUseCase`, `DeleteWorkoutUseCase`; `GetLiveWorkoutStateUseCase` edit branch; `GetWorkoutHistoryUseCase` v2
- [ ] `T9.3-04` - `WorkoutSnapshotPort`, `WorkoutSnapshotAdapter`, `workout-snapshot.instance.ts`, repository factory; routines `deriveRoutineFromWorkout` and `SaveWorkoutAsRoutineUseCase` wired in `routines.composition.ts`
- [ ] `T9.3-05` - API: `finish`, `save-as-routine`, `PATCH` and completed-`DELETE` on `workouts/[id]`, with route-handler cases
- [ ] `T9.3-06` - Reducer, commands, hook and worker: `workout/finished`, `workout/times-edited`, `edit/cancelled`, `pendingEditCommands`, `flush()`
- [ ] `T9.3-07` - `finish-dialog.tsx` and header changes (`Terminar` / `Guardar` / `Cancelar`, edit-mode time fields)
- [ ] `T9.3-08` - `workout-summary.tsx` (tiles, muscles, inline edit, actions) and `/workout/[id]` routing (live, summary, edit, redirects)
- [ ] `T9.3-09` - `/workouts/[id]` owner page and `workout-detail-actions.tsx`; save-as-routine dialog wiring
- [ ] `T9.3-10` - History v2: `history-list.astro`, filters, `history.astro` rewrite
- [ ] `T9.3-11` - Delete Phase 1 files and unreferenced repository methods; fix imports
- [ ] `T9.3-12` - Tests: use cases, repositories, reducer rows, summary worked examples, route handlers, Supabase RLS/RPC, Phase 1 regression
- [ ] `T9.3-13` - Update docs: mark context Use Cases rows `implemented` (the 9.3 rows, and routines row 18), fix any doc/code drift found (snapshot instance module, history use-case location), add Implementation Evidence

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/workout-tracking/finish-plan.test.ts` | unit (table) | `complete` vs `discard`, empty and invalid sets, emptied exercises, `hasValues` (01, 02) |
| `tests/workout-tracking/finish-workout.use-case.test.ts` | use-case | Plan applied, `NoCompletedSetsError` leaves rows intact, times, replay, ownership, short workout (02–04) |
| `tests/workout-tracking/get-workout-summary.use-case.test.ts` | use-case | Duration, volume, top 5 muscles, Δ % worked examples, empty workout (06) |
| `tests/workout-tracking/update-completed-workout.use-case.test.ts` | use-case | Name/notes rules, time validation, `workoutDate` in the user timezone, LWW (07, 09, 10) |
| `tests/workout-tracking/delete-workout.use-case.test.ts` | use-case | Cascade, ownership, in-progress rejected (12) |
| `tests/workout-tracking/get-live-workout-state.use-case.test.ts` | use-case | Edit branch rules (08) |
| `tests/workout-tracking/live-workout.reducer.test.ts` | unit (table) | `workout/finished` live and edit, `times-edited`, `edit/cancelled`, held commands, unchecked resolution (01, 02, 09, 10) |
| `tests/workout-tracking/sync-worker.test.ts` | unit (fake transport) | `flush()` resolves when drained and rejects on a failed command (05) |
| `tests/workout-tracking/get-workout-history.use-case.test.ts` | use-case | v2 items, filters, pagination, in-progress rows (15) |
| `tests/workout-tracking/sqlite-workout.repository.test.ts` | repo | `finish` atomicity, `findPreviousCompletedByRoutineDay`, history filters (03, 06, 15) |
| `tests/workout-tracking/workout-snapshot.adapter.test.ts` | repo | Live rows only, undefined for missing or in-progress (14) |
| `tests/workout-tracking/workout-route-handlers.test.ts` | integration (real SQLite) | `finish`, `PATCH`, `DELETE`, `save-as-routine` status codes (03, 07, 12, 14) |
| `tests/routines/routine-from-workout.test.ts` | unit (table) | Worked examples from the routines readme (14) |
| `tests/routines/save-workout-as-routine.use-case.test.ts` | use-case | Destinations, skipped exercises, errors, with the real snapshot adapter (14) |
| `tests/supabase/rls-workout-finish.integration.test.ts` | integration-RLS | Non-owner cannot finish, update or delete another user's workout (17) |
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` | regression | History count and volumes unchanged; Phase 1 workout editable (11, 15) |
| manual checklist in Implementation Evidence (finish dialogs, edit and cancel, delete, repeat, save as routine, 360 px) | manual | Dialog steps, edit-mode UI, redirects, detail page (01, 05, 08, 13, 16) |

## Out of Scope

- PR list, PR badges and the history PR-count column → [story-10.1](../round-10/story-10.1.md).
- Likes, comments, activity, the family view of `/workouts/[id]` → [story-12.1](../round-12/story-12.1.md); *Compartir* → [story-12.2](../round-12/story-12.2.md).
- Offline finish and edit, IndexedDB outbox, "pendiente de sincronizar" → [story-12.3](../round-12/story-12.3.md).
- Weekly streak and statistics v2 → [story-11.2](../round-11/story-11.2.md); `PrCountPort`-based history in progress → 10.1 / 11.2.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
