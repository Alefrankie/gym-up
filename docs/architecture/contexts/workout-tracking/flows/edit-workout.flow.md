# Edit Workout Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md#phase-2](../readme.md#phase-2) · PRD: [FR-WT-039](../../../../prd/features/workout-tracking.md#fr-wt-039), [FR-WT-018 (4)](../../../../prd/features/workout-tracking.md#fr-wt-018), [FR-PR-018](../../../../prd/features/progress.md#fr-pr-018)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Stories | [9.3](../../../../stories/phase-2/round-9/story-9.3.md), [9.1](../../../../stories/phase-2/round-9/story-9.1.md) (repeat) |
| Decisions | [ADR-015](../../../decisions/015-live-workout-react-island.md), [ADR-020 §4](../../../decisions/020-personal-records.md), [ADR-025](../../../decisions/025-offline-live-workout.md) |

Covers edit, delete and repeat of an **own completed** workout. Editing is online-first: the page must load from the server.

## Happy Path

### Step 1 - Open the workout

User opens *Historial* → a workout → `/workouts/[id]` (read-only detail, [FR-SO-003](../../../../prd/features/social.md#fr-so-003)). The owner sees *Editar*, *Repetir* and *Eliminar*.

### Step 2 - Enter edit mode

*Editar* → `/workout/[id]?mode=edit`. SSR calls `GetLiveWorkoutStateUseCase` (`mode: 'edit'`, owner + `completed`) and mounts `LiveWorkout` in edit mode:

- no elapsed clock and no rest timer;
- no suggestions (only *Anterior*);
- the header shows editable name, notes, start date/time and duration;
- the buttons are *Guardar* / *Cancelar* instead of *Terminar*.

### Step 3 - Change sets and exercises

User fixes a weight, adds a forgotten set, removes an exercise and changes the duration from 75 to 60 min. Each action updates the reducer. Its commands (`upsert-set`, `delete-set`, `remove-exercise`, …) go to `pendingEditCommands` instead of the outbox. `workout/times-edited` sets `completedAt = startedAt + 60 min`.

### Step 4 - Save

*Guardar* dispatches `workout/finished` in edit mode. The reducer moves `pendingEditCommands` into the outbox in order, followed by `finish-workout { mode: 'edit', startedAt, completedAt, name, notes }`. The worker drains them:

- set and exercise commands → the normal use cases (`UpsertSetUseCase`, `DeleteSetUseCase`, `RemoveExerciseUseCase`, …), allowed on completed workouts for the owner;
- `POST /api/workouts/[id]/finish` (`mode: 'edit'`) → `UpdateCompletedWorkoutUseCase`, which validates `startedAt ≤ completedAt ≤ now + 5 min`, recomputes `workoutDate` in `profiles.timezone` and applies LWW.

### Step 5 - Back to the summary

After the drain the island navigates to `/workout/[id]` (summary). Records, stats, feed and calendar re-derive on read ([ADR-020 §4](../../../decisions/020-personal-records.md)).

---

## Failure: Last completed set removed

The edit leaves zero completed sets. *Guardar* shows "Registra al menos una serie" and offers **Eliminar entrenamiento** instead. No commands are sent.

## Failure: Invalid times

The start time is in the future, or the duration makes `completedAt` later than `now`. The header fields show "Revisa la fecha y la duración" and *Guardar* is disabled. The server rejects the same input with `400` if it ever arrives.

## Edge Case: Cancel

*Cancelar* (after confirming "¿Descartar cambios?" when there are pending commands) dispatches `edit/cancelled`. `pendingEditCommands` is dropped and the user returns to `/workouts/[id]`. Nothing reached the server.

## Edge Case: Delete

*Eliminar* on `/workouts/[id]` → confirm "¿Eliminar este entrenamiento?" → `DELETE /api/workouts/[id]` → `DeleteWorkoutUseCase` (owner, `completed`, FK cascade). The user lands on `/history`. Records re-derive; likes and comments cascade ([ADR-024](../../../decisions/024-social-interactions.md)).

## Edge Case: Repeat

*Repetir* → generate `workoutId` → `PUT /api/workouts/[id]` with `{ mode: 'repeat', sourceWorkoutId }` → `RepeatWorkoutUseCase`. It copies the exercise list, order, supersets, rest, set count and set types, with no values, and keeps the source's `routineDayId`. Then `StartWorkoutUseCase` runs; if another workout is in progress, the usual **Continuar el actual** / **Descartar y empezar nuevo** choice applies. The user lands in the live flow at Step 4 of [live-workout.flow.md](./live-workout.flow.md). *Repetir* is never shown on other users' workouts ([FR-SO-009](../../../../prd/features/social.md#fr-so-009)).

## Edge Case: Editing a Phase 1 workout

Phase 1 workouts were backfilled into `workout_exercises` (story 7.1) with `set_type = 'normal'`. They open in edit mode like any other workout. Their `routineDayId` still points to the template routine ([ADR-018 §4](../../../decisions/018-user-owned-programs.md)), so the read-only routine notes come from the template.
