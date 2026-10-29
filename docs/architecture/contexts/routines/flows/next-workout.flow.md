# Next Workout Flow

Parent: [../readme.md](../readme.md) · PRD: [../../../../prd/features/routines.md](../../../../prd/features/routines.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |
| Requirements | FR-RT-010, FR-RT-011, FR-RT-012, FR-RT-013, FR-RT-014, FR-WT-018 |
| Decisions | [ADR-019 §1](../../../decisions/019-rotation-scheduling-and-onboarding.md), [ADR-025 §6](../../../decisions/025-offline-live-workout.md) |
| Stories | [8.3](../../../../stories/phase-2/round-8/story-8.3.md) (readiness/recovery hints: [10.4](../../../../stories/phase-2/round-10/story-10.4.md)) |

Replaces the Phase 1 weekday flow ([start-workout.flow.md](../../workout-tracking/flows/start-workout.flow.md) steps 1–3). There are no rest-day screens (supersedes FR-WT-014).

## Happy Path

### Step 1 - Open the dashboard

`/dashboard` (SSR). If `onboardingCompletedAt` is null the page redirects to `/onboarding` ([onboarding flow](./onboarding.flow.md)). Otherwise it calls `getNextWorkoutUseCase.execute({ userId })`.

### Step 2 - Compute the next routine

1. Read `profiles.active_program_id` and the program's non-archived routines, ordered by `dayNumber`.
2. `last` = latest **completed** workout with `program_id = active program` and `completed_at` after the program's rotation anchor (`routines.rotation_anchor_at`).
3. `next` = first routine with `dayNumber > last.dayNumber`, else the first routine. No `last` → the first routine.

### Step 3 - Siguiente entrenamiento card

`NextWorkoutCard` (FR-RT-011) shows: "Siguiente: {routine name}", the program name, each exercise as "{name} · {sets} × {min}–{max}" (seconds for duration types, sets only for distance types), "≈ {N} min" from `estimateRoutineMinutes` (Σ (sets + warm-up sets) × (40 s + rest) + 5 min, rounded to 5 min), and the *Empezar* button. From story 10.4 the page adds readiness and recovery hints for the routine's `muscleGroups` ([FR-PG-011](../../../../prd/features/progression.md#fr-pg-011)).

### Step 4 - Empezar

*Empezar* posts the routine ID to the workout-tracking start endpoint. Workout-tracking reads the plan through `RoutinePlanPort.findRoutinePlan(routineDayId)`, copies the exercises into `workout_exercises` and sets `workouts.program_id` and `workouts.name` (story 9.1; until then the Phase 1 `POST /api/workouts` with `routine_day_id`). If a workout is already in progress, FR-WT-019 asks *Continuar el actual* / *Descartar y empezar nuevo*.

### Step 5 - Elegir otra rutina

Below the card, *Elegir otra rutina* (FR-RT-012) lists every other non-archived routine of the active program in rotation order, each with "hecha hace N días" ("hoy", "ayer", "hace N días", or "Nunca") and, from story 10.4, a fatigue marker. Tapping one starts it like step 4. *Entrenamiento libre* starts an empty workout (FR-WT-018).

### Step 6 - Rotation advances

After the user finishes a workout of routine K, the next dashboard load shows routine K + 1 (wrapping to the first after the last). Training a routine out of order moves the rotation to the routine after the one actually done (Gravl behaviour).

---

## Edge Case: No active program

`{ kind: 'no_program' }` (FR-RT-014): the card is replaced by "Elige tu programa" with *Responder el cuestionario* (→ `/onboarding`) and *Ver plantillas* (→ `/train/templates`), plus *Entrenamiento libre*.

## Edge Case: Active program without routines

`{ kind: 'empty_program' }`: "Tu programa «{name}» no tiene rutinas" with *Añadir rutina* (→ `/train/routines/new?program=<id>`) and *Entrenamiento libre*.

## Edge Case: Active program changed

`SetActiveProgramUseCase` moves the rotation anchor, so the next routine is the first of the new program (FR-RT-004, FR-RT-013, OQ-003). Switching back to an earlier program also starts it at its first routine. Past workouts are untouched.

## Edge Case: Routines reordered

`ReorderRoutinesUseCase` moves the anchor: the next routine becomes the new first one (FR-RT-013).

## Edge Case: Last routine archived

If the last completed workout's routine is now archived, its `dayNumber` is still used to find the next active routine; archived routines are never proposed.

## Edge Case: Migrated Phase 1 user

Phase 1 workouts point at template routines and have no `program_id`, so the rotation of the adopted program starts at its first routine. "hecha hace N días" shows "Nunca" until the user trains with the new copy.

## Edge Case: Free workouts and other programs

Workouts with `program_id = NULL` (empty workouts) or another program do not move the rotation.

## Edge Case: Offline start

The service worker caches `GET /api/routines/next` (stale-while-revalidate). Offline, the dashboard renders the cached payload and *Empezar* uses it for the outbox command `start-workout` ([ADR-025 §6](../../../decisions/025-offline-live-workout.md)). The next routine may be stale if a workout was finished on another device.

## Failure: Active program not readable

The active program was deleted elsewhere (`active_program_id` set to NULL by `ON DELETE SET NULL`): the use case returns `no_program` and the dashboard shows the "Elige tu programa" card.
