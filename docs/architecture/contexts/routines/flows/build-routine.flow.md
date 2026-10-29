# Build Routine Flow

Parent: [../readme.md](../readme.md) · PRD: [../../../../prd/features/routines.md](../../../../prd/features/routines.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |
| Requirements | FR-RT-007, FR-RT-008, FR-RT-009, FR-EL-005 |
| Stories | [8.2](../../../../stories/phase-2/round-8/story-8.2.md) |

## Happy Path

### Step 1 - Start a new routine

On `/train/programs/[id]` (own program, not archived) the user taps *Nueva rutina* → `/train/routines/new?program=<id>`. The page checks ownership (403 otherwise) and the limit of 14 routines (the button is disabled at the limit with "Máximo 14 rutinas por programa"). It mounts the `routine-builder` island with an empty routine.

### Step 2 - Name and notes

Nombre (required, 1–60) and Notas (optional, ≤ 500). *Guardar* stays disabled while the name is empty.

### Step 3 - Add exercises

*+ Añadir ejercicios* opens the [exercise picker](../../exercise-library/flows/pick-exercises.flow.md) in `add` mode with `maxSelectable = 30 − current`. The returned IDs are appended in selection order, each with `RoutineExerciseDefaults`:

| Field | Default |
|---|---|
| Series objetivo | 3 |
| Rango | 8–12 reps; 30–60 s for `duration`; hidden for `distance_duration` / `weight_distance` |
| Series de calentamiento | 0 |
| Descanso | Por defecto (`profiles.default_rest_seconds`) |
| RPE objetivo | — |
| Nota | — |

### Step 4 - Edit each exercise

Per row (`RoutineExerciseRow`, FR-RT-008): sets 1–20; rep range `1 ≤ min ≤ max ≤ 100` (a min above max is corrected by moving max up); warm-up sets 0–5; rest 0–600 s in 15 s steps or "Por defecto" (0 = "Sin descanso"); RPE 6–10 or empty; note ≤ 300. Invalid values show inline and block *Guardar*.

### Step 5 - Supersets

Row menu → *Superserie con el siguiente* links the row with the next one; repeating on the next row extends the group. Linked rows share a colored bar and letters (A1, A2). *Quitar superserie* unlinks. Groups are always contiguous rows; the client renumbers them 1..n.

### Step 6 - Reorder and replace

Drag handles (or up/down buttons) reorder rows; a row dragged into or out of a superset leaves it. Row menu → *Reemplazar* opens the picker in `replace` mode and swaps the exercise, keeping the targets; when the new exercise changes between rep, duration and distance types, the range resets to that type's default. Row menu → *Eliminar* removes the row.

### Step 7 - Save

*Guardar* → `POST /api/routines` (`SaveRoutineInput`) → `SaveRoutineUseCase` → one transaction (routine row + all exercise rows). New routines get `dayNumber = max + 1`. On `201` the user returns to `/train/programs/[id]` with "Rutina guardada".

---

## Edge Case: Edit an existing routine

`/train/routines/[id]/edit` → `GET /api/routines/[id]` (SSR) → same island, prefilled → *Guardar* → `PUT /api/routines/[id]` (full replace). Past workouts are not affected: they own their `workout_exercises`. The rotation is not restarted.

## Edge Case: Leave with unsaved changes

*Cancelar*, back navigation or closing the tab with a dirty state asks "¿Descartar cambios?" (*Descartar* / *Seguir editando*). `beforeunload` covers tab close.

## Edge Case: Same exercise twice

Allowed (ADR-016 §1). Each row keeps its own targets.

## Edge Case: Archived exercise already in the routine

A row whose custom exercise was archived later stays, with an "Archivado" badge, and saves fine (FR-EL-008). It cannot be added again from the picker.

## Edge Case: Duplicate, archive, delete

From the program page: *Duplicar* → `POST /api/routines/[id]/duplicate` ("Push A (copia)", appended last). *Eliminar* → `DELETE /api/routines/[id]`; if workouts reference it the API answers 409 `in_use` and the UI offers *Archivar* instead ("Esta rutina tiene entrenamientos. Puedes archivarla."). Archived routines leave the rotation and appear under "Archivadas" with *Restaurar*.

## Edge Case: Reorder routines

On the program page, dragging routines → `PUT /api/programs/[id]/routines/order`. The rotation restarts from the first routine (FR-RT-013), and the UI says so: "El orden cambió. Tu siguiente rutina será «{first}»."

## Failure: Exercise no longer pickable

The server rejects a new exercise (`ExerciseNotPickableError`, 400), for example a custom exercise archived on another device. The builder marks the row "No disponible" and keeps the rest of the state so the user can remove it and save again.

## Failure: Limits

Routine limit (`RoutineLimitReachedError`, 409) or 31st exercise (blocked client-side by `maxSelectable`; 400 server-side). Messages: "Máximo 14 rutinas por programa", "Máximo 30 ejercicios".

## Failure: Not the owner

Opening the builder on a sibling's or template routine → 403 page. Siblings use *Guardar rutina* (copy) instead (FR-RT-006).

## Failure: Offline

*Guardar* offline fails with "Necesitas conexión para guardar la rutina"; the island keeps the edits in memory. Decision: routine editing is not part of the ADR-025 outbox.
