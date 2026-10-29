# Pick Exercises Flow

Parent: [../readme.md](../readme.md) · PRD: [../../../../prd/features/exercise-library.md](../../../../prd/features/exercise-library.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |
| Requirements | FR-EL-005, FR-EL-002, FR-EL-004, FR-EL-006, FR-EL-008, FR-EL-009, NFR-EL-01; hosts: [FR-WT-021](../../../../prd/features/workout-tracking.md#fr-wt-021), [FR-WT-024](../../../../prd/features/workout-tracking.md#fr-wt-024), [FR-RT-007](../../../../prd/features/routines.md#fr-rt-007) |
| Stories | [7.3](../../../../stories/phase-2/round-7/story-7.3.md) (picker), [7.4](../../../../stories/phase-2/round-7/story-7.4.md) (inline create), [8.2](../../../../stories/phase-2/round-8/story-8.2.md) and [9.1](../../../../stories/phase-2/round-9/story-9.1.md) (hosts) |

The picker (`exercise-picker.tsx`) is a component inside two host islands: the **live workout** (workout-tracking) and the **routine builder** (routines). It only returns exercise IDs; each host decides what to do with them.

| Host | Mode | Trigger | What the host does with the IDs |
|---|---|---|---|
| Live workout | `add` | *+ Añadir ejercicio* | Appends one workout exercise per ID, in order, each with one empty set (FR-WT-021) |
| Live workout | `replace` | Exercise menu → *Reemplazar* | Swaps the exercise; keeps set values when both share `exercise_type`, otherwise clears them after confirmation (FR-WT-024) |
| Routine builder | `add` | *+ Añadir ejercicios* | Appends one routine exercise per ID with `RoutineExerciseDefaults` ([routines context](../../routines/readme.md)) |
| Routine builder | `replace` | Exercise menu → *Reemplazar* | Swaps `exerciseId`, keeps the targets. Decision: Hevy's routine editor also offers replace |

## Happy Path

### Step 1 - Open

The host opens the picker with `mode` and `maxSelectable` (in `add` mode: 30 minus the exercises already present, `MaxExercises` / `ProgramRules.MaxExercisesPerRoutine`; in `replace` mode: 1). It renders as a bottom sheet below 768 px and as a modal above. The catalog comes from `loadExerciseCatalog()` (already in memory or in the SW cache, so the sheet opens in < 300 ms, NFR-EL-01).

### Step 2 - Browse

Same list, search and filters as [browse-exercises](./browse-exercises.flow.md) steps 3–5: Recientes first (no query, no filter), then alphabetical. Only pickable exercises are listed: system exercises and the user's own non-archived custom exercises (ADR-017 §1). Exercises already in the workout or routine are listed normally, because the same exercise may appear twice (ADR-016 §1).

### Step 3 - Multi-select (add mode)

Tapping a row toggles it. Selected rows show a numbered badge with their **selection order** (1, 2, 3 …). Deselecting renumbers the rest. The bottom button reads *Añadir (N)* and is disabled while N = 0. Search and filter changes keep the selection.

### Step 4 - Confirm

*Añadir (N)* calls `onConfirm(ids)` with the IDs in selection order and closes the picker. The host applies its behaviour from the table above.

### Step 5 - Server-side check

The host's write endpoint re-validates every ID with `ExerciseCatalogPort.findUsableByIds(ids, userId)`. An ID missing from the result (`canPick` rejects it as `not_found`, `archived` or `not_owner`) fails the request with 400. The picker list is a convenience, not the guard.

---

## Edge Case: Replace mode

`maxSelectable = 1`, no badges and no confirm button. Tapping a row immediately calls `onConfirm([id])` and closes. Decision: Hevy replaces on tap.

## Edge Case: Inline create

*+ Crear ejercicio* (header, and in the no-results state prefilled with the query) swaps the sheet content for `CustomExerciseForm` ([create-custom-exercise flow](./create-custom-exercise.flow.md)). On success (`201`):

- the new item is added to the in-memory catalog (`addToCatalogCache`);
- `add` mode: it is appended to the selection with the next order number and the list returns, so the user can keep selecting;
- `replace` mode: `onConfirm([newId])` is called immediately.

*Cancelar* in the form returns to the list with the selection intact.

## Edge Case: Capacity reached

Selecting beyond `maxSelectable` is blocked with the toast "Máximo 30 ejercicios". When `maxSelectable` is 0 the host disables the trigger instead of opening the picker.

## Edge Case: Close without confirming

Swipe down, backdrop tap, Escape or *Cancelar* calls `onClose()`. Nothing changes in the host.

## Edge Case: Family member's custom exercises

Never listed (FR-EL-009). When a sibling's routine that uses one is copied, the routines context skips it ([routines context](../../routines/readme.md)).

## Edge Case: Offline

The cached catalog works offline. In the live workout, confirmed IDs are applied locally and queued as the outbox command `add-exercise` ([ADR-025 §4](../../../decisions/025-offline-live-workout.md)). *+ Crear ejercicio* is disabled offline ("Necesitas conexión para crear ejercicios").

## Failure: Catalog not available

No network and no cached catalog: the sheet shows "No se pudo cargar la biblioteca" with *Reintentar*. The host stays unchanged.

## Failure: Server rejects an ID

Step 5 returns 400 (for example, the exercise was archived on another device). The host shows "Un ejercicio ya no está disponible", reloads the catalog (`loadExerciseCatalog({ force: true })`) and drops the rejected exercise from its local state.
