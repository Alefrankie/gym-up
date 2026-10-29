# Finish Workout Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md#phase-2](../readme.md#phase-2) · PRD: [FR-WT-035](../../../../prd/features/workout-tracking.md#fr-wt-035), [FR-WT-036](../../../../prd/features/workout-tracking.md#fr-wt-036)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Stories | [9.3](../../../../stories/phase-2/round-9/story-9.3.md), [10.1](../../../../stories/phase-2/round-10/story-10.1.md) (PR list), [12.3](../../../../stories/phase-2/round-12/story-12.3.md) (offline) |
| Decisions | [ADR-016 §5](../../../decisions/016-workout-data-model-v2.md), [ADR-020](../../../decisions/020-personal-records.md), [ADR-025](../../../decisions/025-offline-live-workout.md) |

Starts at Step 10 of [live-workout.flow.md](./live-workout.flow.md).

## Happy Path

### Step 1 - Tap *Terminar*

User taps *Terminar* in `WorkoutHeader`. `FinishDialog` computes from the island state, without a server call:

- `completedSets` = live sets with `completed = true`;
- `uncheckedWithValues` = unchecked sets with at least one metric value;
- elapsed = `now − startedAt`.

### Step 2 - Unchecked sets

If `uncheckedWithValues > 0`, the dialog shows "Tienes N series sin marcar" with **Marcarlas como hechas** (`uncheckedResolution = 'complete'`) and **Descartarlas** (`'discard'`). Sets with no values are discarded silently and never mentioned.

### Step 3 - Duration check

If elapsed > `WorkoutSessionRules.ForgotToFinishMinutes` (180 min), the dialog shows "¿Olvidaste terminar?" with an editable end time, defaulting to the `completedAt` of the last completed set. The user confirms or edits it ([ADR-016 §5](../../../decisions/016-workout-data-model-v2.md)).

### Step 4 - Dispatch

The island dispatches `workout/finished { completedAt, uncheckedResolution }`. The reducer applies the same resolution locally and emits `finish-workout` with the header `name` and `notes`. Volume and set counts are frozen in the island.

### Step 5 - Server finish

The worker sends `POST /api/workouts/[id]/finish` (`mode: 'live'`) → `FinishWorkoutUseCase`:

1. Ownership; the workout is `in_progress`.
2. Builds a `FinishPlan`: empty sets removed; unchecked sets completed (if valid) or removed; exercises left with no sets removed.
3. ≥ 1 completed set.
4. `startedAt ≤ completedAt ≤ now + 5 min`.
5. `workoutRepository.finish` in one transaction → `status = 'completed'`.

Response `200 { workoutId }`.

### Step 6 - Summary v2

Once the outbox has acked `finish-workout`, the island navigates to `/workout/[id]`. SSR sees a completed own workout and renders `WorkoutSummary` v2 from:

- `GetWorkoutSummaryUseCase`: duration, volume, completed sets, top 5 muscles by sets, volume Δ % vs the previous workout of the same routine;
- progress `GetWorkoutPrsUseCase` for the PR list ([FR-PR-010](../../../../prd/features/progress.md#fr-pr-010)).

### Step 7 - Edit name / notes and act

Name and notes are editable inline → `PATCH /api/workouts/[id]` → `UpdateCompletedWorkoutUseCase`. Actions: *Añadir foto* ([FR-PP-003](../../../../prd/features/private-photos.md#fr-pp-003)), *Compartir* ([FR-SO-008](../../../../prd/features/social.md#fr-so-008)), *Guardar como rutina* ([FR-RT-018](../../../../prd/features/routines.md#fr-rt-018)), *Listo* → `/dashboard`. The rotation now points to the next routine ([ADR-019 §1](../../../decisions/019-rotation-scheduling-and-onboarding.md)).

---

## Failure: No completed sets

At Step 1, `completedSets = 0` (after the Step 2 resolution). The dialog shows "Registra al menos una serie" with **Seguir entrenando** and **Descartar entrenamiento**. Discard dispatches `workout/discarded`: the outbox removes this workout's pending commands, enqueues `discard-workout`, and `DELETE /api/workouts/[id]` → `DiscardWorkoutUseCase` ([FR-WT-038](../../../../prd/features/workout-tracking.md#fr-wt-038)). The island navigates to `/dashboard`.

If the server still answers `422 no_completed_sets` (another device unchecked sets), the command moves to `outbox_failed`, the banner explains it, and the workout stays `in_progress` on the server.

## Failure: Unchecked set fails validation

With **Marcarlas como hechas**, an unchecked row whose metrics fail `validateSetMetrics` (e.g. weight without reps) is removed, not completed. The client and server apply the same rule, so their totals agree.

## Edge Case: Finishing offline

From story 12.3: `finish-workout` stays in the outbox. The island shows "Entrenamiento terminado · pendiente de sincronizar" with the local duration, volume, sets and live PR badges. Decision: it navigates to the SSR summary automatically when the outbox drains, and the user may leave earlier with *Ir al inicio*. (Simplest option; the summary needs server data.) The in-progress banner is hidden locally from the moment of finish.

## Edge Case: Replay

The worker resends `finish-workout` after a lost response. The workout is already `completed`, so `FinishWorkoutUseCase` returns `replayed` (`200`) and changes nothing.

## Edge Case: Very short workout

A 10-minute single-exercise session with one completed set finishes normally. There is no minimum duration or exercise count ([ADR-016 §5](../../../decisions/016-workout-data-model-v2.md)).
