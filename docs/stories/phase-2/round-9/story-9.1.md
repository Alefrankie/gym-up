---
story_id: "9.1"
round: "round-9"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/workout-tracking/readme.md"
size: "L"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-018", "FR-WT-019", "FR-WT-020", "FR-WT-021", "FR-WT-022", "FR-WT-023", "FR-WT-024", "FR-WT-025", "FR-WT-026", "FR-WT-038"]
  architecture_decisions: ["ADR-015", "ADR-016"]
  flows: ["live-workout.flow.md"]
blocked_by: ["story-7.1", "story-7.3", "story-8.3"]
blocks: ["story-9.2", "story-9.4"]
---

# Story 9.1 — Live workout island — session & exercises

Parent: [../readme.md](../readme.md)

## Summary

Replaces the Phase 1 form page `/workout/[id]` with the `LiveWorkout` React island ([ADR-015](../../../architecture/decisions/015-live-workout-react-island.md)): one reducer, a pure command mapper, an outbox behind an interface and an online-only sync worker. Ships `StartWorkoutUseCase` v2 in the four modes of [FR-WT-018](../../../prd/features/workout-tracking.md#fr-wt-018), the one-in-progress rule, exercise management (add, remove, reorder, replace, supersets, session notes), the header with live stats, and discard. Deletes `exercise-card.astro` and `src/lib/client/auto-save.ts`. Closes Hevy rows H1, H2, H3 (structure; the superset timer rule is in 9.2) and H9 (clock; volume and sets stay at 0 until 9.2 adds set rows).

## Files in scope

**Modify**

- `src/pages/workout/[id].astro` — rewrite: owner + `in_progress` mounts `LiveWorkout`; `completed` keeps the Phase 1 `workout-summary.astro` until 9.3.
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` — add `createIfAbsent`, `createFromSkeleton`, `findAggregate` (existing Phase 1 methods stay).
- `src/lib/contexts/workout-tracking/domain/workout-tracking.types.ts` and `workout-tracking.constants.ts` — add the Phase 2 types and `WorkoutStartModes` that 7.1 did not already add.
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository.ts`, `.../supabase/supabase-workout.repository.ts`.
- `src/lib/contexts/workout-tracking/application/start-workout.use-case.ts` — rewrite to v2.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — new use cases, null adapters, provider ports; remove the `routineRepository` export.
- `src/pages/dashboard.astro` and the 8.3 start controls (`src/components/routines/next-workout-card.*`, `routine-picker-list.astro`) and the 8.2 `/train` start buttons — replace the `POST /api/workouts` form with `StartWorkoutButton`.
- `tests/workout-tracking/composition.test.ts`, `tests/workout-tracking/smoke.test.ts` — drop the removed exports.

**Create**

- Domain (`src/lib/contexts/workout-tracking/domain/`): `workout-skeleton.ts`, `superset.ts`, `training-settings.ts` (`toTrainingSettings(profile)`).
- Provider port stubs (the providers extend these files in 10.1 and 10.2, they do not replace them): `src/lib/contexts/progression/domain/ports/suggestion.port.ts` plus `src/lib/contexts/progression/domain/progression.types.ts` (only `RepRange`, `Suggestion`, `SuggestionContext`, `ExerciseSuggestion`); `src/lib/contexts/progress/domain/ports/record-baseline.port.ts` plus `src/lib/contexts/progress/domain/progress.types.ts` (only `RecordType`, `ScalarRecordType`, `RecordBaseline`). Shapes are copied verbatim from the [progression](../../../architecture/contexts/progression/readme.md) and [progress](../../../architecture/contexts/progress/readme.md) readmes.
- Null adapters (`src/lib/contexts/workout-tracking/infrastructure/null-adapters/`): `no-suggestion.adapter.ts`, `no-record-baseline.adapter.ts`.
- Application (`.../application/`): `repeat-workout.use-case.ts`, `get-active-workout.use-case.ts`, `get-live-workout-state.use-case.ts`, `add-exercises.use-case.ts`, `remove-exercise.use-case.ts`, `reorder-exercises.use-case.ts`, `replace-exercise.use-case.ts`, `set-superset.use-case.ts`, `update-workout-exercise.use-case.ts`, `discard-workout.use-case.ts`, `workout-api-errors.ts` (domain error → status and `{ error, details? }`), `workout-route-handlers.ts` (injectable handler factories, same pattern as `nutrition/application/analyze-route-handler.ts`).
- API (`src/pages/api/`): `workouts/[id].ts` (PUT, DELETE), `workouts/active.ts`, `workouts/[id]/live-state.ts`, `workouts/[id]/exercise-context.ts`, `workouts/[id]/exercise-order.ts`, `workout-exercises/[id].ts` (PUT, PATCH, DELETE).
- Island (`src/components/live-workout/`): `live-workout.tsx`, `live-workout.reducer.ts`, `live-workout.commands.ts`, `live-workout.selectors.ts`, `use-live-workout.ts`, `workout-header.tsx`, `exercise-block.tsx`, `superset-bar.tsx`, `confirm-dialog.tsx`, `start-workout-button.tsx`, `start-workout-client.ts`, `sync/outbox.ts`, `sync/sync-worker.ts`.
- Tests and mothers: see [Test Plan](#test-plan). Mothers `live-workout-state.mother.ts` and `routine-plan.mother.ts` in `tests/workout-tracking/mothers/` (the other mothers come from 7.1).

**Delete**

- `src/components/exercise-card.astro`, `src/lib/client/auto-save.ts`, `src/pages/api/workouts.ts` (form start).
- `src/lib/contexts/workout-tracking/domain/routine.repository.ts` and both implementations ([routines readme, Phase 1 code that moves](../../../architecture/contexts/routines/readme.md)); the Phase 1 `tests/workout-tracking/start-workout.use-case.test.ts` (replaced).

**Not in scope** (must not change): `src/components/rest-timer.tsx`, `src/styles/rest-timer.css`, `src/pages/api/workout-entries.ts` (9.2); `src/pages/api/workouts/[id]/complete.ts`, `src/components/workout-summary.astro`, `complete-workout.use-case.ts` (9.3); `db/`, `supabase/migrations/` (the schema and the four RPCs ship in 7.1).

## Decisions

- Round 9 ships as a unit. After 9.1 the island shows exercises but set rows are read-only placeholders (label and "—"), and there is no *Terminar* button (9.3). Phase 1 `POST /api/workouts/[id]/complete` stays until 9.3 but no UI calls it.
- `start-workout` is sent **directly** by `StartWorkoutButton` (`PUT /api/workouts/[id]`, awaited, then navigate), not through the outbox: `MemoryOutboxStore` dies on navigation. The command name stays in `OutboxCommandName` and in the worker's `send` map so story 12.3 can enqueue it through IndexedDB.
- `StartWorkoutButton` (`mode`, `routineDayId?`, `sourceWorkoutId?`, `plan?`, `activeWorkout`) is the single start control for the dashboard, `/train`, routine lists and (9.3) *Repetir*. With a `plan` prop (next routine) it builds the skeleton client-side with `buildWorkoutSkeleton`; otherwise the server builds it. `422 workout_in_progress` and `activeWorkout` open **Continuar el actual** / **Descartar y empezar nuevo** (`discardInProgress: true`).
- `RepeatWorkoutUseCase` and `mode: 'repeat'` ship here (backend); the *Repetir* button on the detail page ships in 9.3. A source that is not own and completed: another user's → `403`; unknown → `404`; own but `in_progress` → `422 source_not_completed`.
- `GetActiveWorkoutUseCase` and `GET /api/workouts/active` ship here. The `InProgressBanner` component and its layout mount ship in 9.4; until then the dashboard card uses its `activeWorkout` prop.
- `/workout/[id]` for a non-owner keeps the Phase 1 `403` until 9.3 creates `/workouts/[id]`, which then receives the redirect.
- `GetLiveWorkoutStateUseCase` returns `previous: {}` until 9.2, `suggestions: {}` until 10.2 and `prBaselines: {}` until 10.1 (null adapters). `GET /api/workouts/[id]/exercise-context` returns the same three empty maps for added exercises.
- Provider ports are imported from the provider's **instance module** (`routines/routine-plan.instance.ts`, exercise-library composition singleton), not from `routines.composition.ts`, to avoid the import cycle described in the routines readme.
- Child ids (`workout_exercises`, sets) are client UUIDs when the client builds the skeleton and server UUIDs otherwise; the workout id is always a client UUID. Every action carries `at`; commands use `updatedAt = at`.
- Reorder UI: pointer events with a 250 ms long-press on the handle plus *Subir/Bajar* menu items (no drag library). Superset group numbers are chosen by the client as `max(existing) + 1`.
- A removed exercise is hard-deleted here (FK cascade); tombstones arrive in 12.3.
- Shared `confirm-dialog.tsx` serves "Se borrarán N series", the replace-clears-values confirmation, discard and continue/discard. (Simplest: one dialog, Hevy-style.)

## Happy Path

1. User taps *Empezar* on the dashboard card. `StartWorkoutButton` generates `workoutId`, builds the skeleton from the card's plan (client ids), sends `PUT /api/workouts/[id]` with `mode: 'next_routine'` and navigates on `201` ([FR-WT-018](../../../prd/features/workout-tracking.md#fr-wt-018)).
2. `StartWorkoutUseCase` checks idempotency, the one-in-progress rule ([FR-WT-019](../../../prd/features/workout-tracking.md#fr-wt-019)), the plan's owner and the exercises, then `createFromSkeleton` inserts workout, exercises and empty sets (warm-up rows first) in one transaction.
3. `/workout/[id]` SSR calls `GetLiveWorkoutStateUseCase` and mounts `LiveWorkout` with `client:load`; the reducer runs `state/initialized`.
4. The header shows the editable name, the elapsed clock (`now − startedAt`, once per second), volume and completed sets ([FR-WT-020](../../../prd/features/workout-tracking.md#fr-wt-020)).
5. User taps *+ Añadir ejercicio* and multi-selects in `ExercisePicker` (7.3). `exercise/added` appends them with one empty set each and enqueues `add-exercise` per exercise; the island fetches `exercise-context` and dispatches `exercise/context-loaded` ([FR-WT-021](../../../prd/features/workout-tracking.md#fr-wt-021)).
6. User drags or uses *Subir/Bajar* (`exercise/moved` → `reorder-exercises`), opens *Reemplazar* (`exercise/replaced` → `update-exercise`), or *Eliminar* with confirmation (`exercise/removed` → `remove-exercise`) ([FR-WT-022](../../../prd/features/workout-tracking.md#fr-wt-022), [023](../../../prd/features/workout-tracking.md#fr-wt-023), [024](../../../prd/features/workout-tracking.md#fr-wt-024)).
7. *Superserie con…* links two exercises (`exercise/superset-linked`): same `supersetGroup`, contiguous, labelled A1/A2 with a `SupersetBar` ([FR-WT-025](../../../prd/features/workout-tracking.md#fr-wt-025)).
8. User edits the session note under an exercise (`exercise/notes-changed`); the routine's note shows read-only above it ([FR-WT-026](../../../prd/features/workout-tracking.md#fr-wt-026)).
9. Header menu → *Descartar entrenamiento* → confirm → `workout/discarded` → `discard-workout` → `DELETE /api/workouts/[id]` → `/dashboard` ([FR-WT-038](../../../prd/features/workout-tracking.md#fr-wt-038)).
10. *Entrenamiento libre* follows the same path with `mode: 'empty'`: no routine, name "Entrenamiento libre", the island shows "Añade tu primer ejercicio".

## Acceptance Criteria

- AC-9.1-01: `PUT /api/workouts/[id]` starts a workout in each mode. `next_routine` and `routine` create one `workout_exercises` row per routine exercise (position, rest, superset group copied) and `warmup_sets` warm-up rows followed by `target_sets` normal rows, all empty, with `programId`, `routineDayId` and `name` (the routine name) set. `empty` creates `routineDayId = NULL`, `name = "Entrenamiento libre"` and no exercises. Response `201` ([FR-WT-018](../../../prd/features/workout-tracking.md#fr-wt-018)).
- AC-9.1-02: Mode `repeat` copies exercise list, order, supersets, rest, set count and set types of an own completed workout with no values and keeps its `routineDayId`, `programId` and `name`. Another user's source returns `403`, an in-progress source `422 source_not_completed`.
- AC-9.1-03: Replaying the same `PUT` returns `200 replayed` and creates no extra rows. A `PUT` on an id owned by another user returns `403`.
- AC-9.1-04: Starting while another workout is `in_progress` returns `422 { error: 'workout_in_progress', details: { workoutId } }`. With `discardInProgress: true` the old workout and its children are deleted and the new one starts. Two concurrent starts leave exactly one `in_progress` row (partial unique index) and the loser gets `422` ([FR-WT-019](../../../prd/features/workout-tracking.md#fr-wt-019)).
- AC-9.1-05: A routine owned by someone else, or a template routine, returns `400 invalid_routine_day`; an archived or sibling-owned custom exercise returns `400 exercise_not_pickable`; more than 30 exercises or 20 sets per exercise returns `422 limit_exceeded`.
- AC-9.1-06: `GET /api/workouts/active` returns `200 { id, name, startedAt }` for the user's in-progress workout and `204` otherwise; `401` without a session. The static `active` route is not shadowed by `[id]`.
- AC-9.1-07: `/workout/[id]` renders the island for the owner of an `in_progress` workout, the Phase 1 summary for a completed one, `404` for an unknown id and `403` for a non-owner. The island prop equals the output of `GetLiveWorkoutStateUseCase`.
- AC-9.1-08: Adding exercises appends them in picker order at the end with one empty set each, positions stay dense, the same exercise may appear twice, and the 31st is blocked in the UI and rejected by the server. `PUT /api/workout-exercises/[id]` is idempotent and returns `403` for another user's workout.
- AC-9.1-09: Removing an exercise deletes it and its sets, re-densifies positions and normalizes supersets (a group left with one member becomes `NULL`). The confirmation "Se borrarán N series" appears only when it has completed sets. `DELETE /api/workout-exercises/[id]?updatedAt=` on an already removed row returns `200` (`stale`).
- AC-9.1-10: Reordering rewrites `position` from the ordered ids. Unknown ids are ignored, live ids missing from the list are appended in their current order, rows with a newer stored `updatedAt` keep their position, supersets are re-normalized. The *Subir/Bajar* items give the same result as drag.
- AC-9.1-11: Replacing with an exercise of the same `exercise_type` keeps set values; with a different type the user confirms and the request carries `clearSets: true`, otherwise `422 replace_requires_clear`. Clearing keeps the set rows and their types and empties the metrics. `exercise_id` is updated on the exercise and all its sets in one transaction.
- AC-9.1-12: Superset link and unlink produce contiguous groups with labels A1, A2…; `SupersetBar` uses one of 6 colors by group order; dragging an exercise out of its group or removing its neighbour dissolves the group. Table tests cover `normalizeSupersets` and the reducer.
- AC-9.1-13: The header name is editable (1–60 chars; a blank value keeps the stored name), the clock derives from `startedAt` (test with an injected clock, never a counter), and `selectTotals` returns elapsed, volume (`Σ max(0, weight) × reps` of completed sets) and completed-set count. Session notes are limited to 500 chars and the routine note is read-only.
- AC-9.1-14: Discard asks for confirmation, removes this workout's pending commands, enqueues `discard-workout`, and `DELETE /api/workouts/[id]` deletes the workout and every child. Already gone returns `200`; another user's workout returns `403`; a completed workout returns `422 workout_not_in_progress` (9.3 adds delete for completed workouts).
- AC-9.1-15: `toCommands` maps every 9.1 action to the exact commands of the workout-tracking readme (`add-exercise`, `update-exercise`, `remove-exercise`, `reorder-exercises`, `discard-workout`); `workout/renamed`, `workout/notes-changed` and `sync/*` emit none. The reducer never calls `Date.now()` or `crypto`.
- AC-9.1-16: The sync worker drains in `seq` order, one at a time. `2xx` (including `stale`) acks; `401` pauses with "Inicia sesión para sincronizar"; other `4xx` moves the entry to failed and shows "N cambios no se pudieron guardar"; `5xx` or a network error retries after `min(2^attempts s, 300 s)`. Dispatching never waits for the network. `OutboxStore` is an interface; `MemoryOutboxStore` passes a shared contract test suite that 12.3's IndexedDB store must also pass.
- AC-9.1-17: Both backends pass the same use-case tests (`STORAGE_BACKEND=sqlite|supabase`). Supabase integration: as a non-owner, `start_workout_v2`, `upsert_workout_exercise` and a delete on another user's workout or exercise fail ([ADR-004](../../../architecture/decisions/004-rls-visibility.md)).
- AC-9.1-18: `exercise-card.astro`, `auto-save.ts`, `routine.repository.ts` (and implementations) and `POST /api/workouts` no longer exist and nothing imports them; `astro check` and the build pass ([AC-R9-05](./readme.md#acceptance-criteria-round-level)).
- AC-9.1-19: Phase 1 regression: after the 7.1 migration an in-progress Phase 1 workout opens in the island with its exercises in Phase 1 order, and `tests/workout-tracking/phase-1-fixture.regression.test.ts` still passes.
- AC-9.1-20: At 360 px every control is ≥ 44 px (*+ Añadir ejercicio* 48 px) and the page has no horizontal scroll (NFR-WT-P2-04).

## Tasks

- [ ] `T9.1-01` - Create provider port stubs, minimal provider type files and the two null adapters; add `toTrainingSettings` (`training-settings.ts`) and any missing Phase 2 types and `WorkoutStartModes`
- [ ] `T9.1-02` - Pure domain: `workout-skeleton.ts` (`plan`, `repeat`, `empty` sources) and `superset.ts` (`normalizeSupersets`) with table tests
- [ ] `T9.1-03` - `WorkoutRepository`: `createIfAbsent`, `createFromSkeleton`, `findAggregate` (abstract class + `SqliteWorkoutRepository`, transactions, `WorkoutInProgressError` mapping)
- [ ] `T9.1-04` - `SupabaseWorkoutRepository`: same methods via `start_workout_v2` and nested selects (live rows only)
- [ ] `T9.1-05` - Use cases `StartWorkoutUseCase` v2, `RepeatWorkoutUseCase`, `GetActiveWorkoutUseCase`, `DiscardWorkoutUseCase` with typed errors
- [ ] `T9.1-06` - Use cases `AddExercisesUseCase`, `RemoveExerciseUseCase`, `ReorderExercisesUseCase`, `ReplaceExerciseUseCase`, `SetSupersetUseCase`, `UpdateWorkoutExerciseUseCase` (notes; rest validation lands in 9.2)
- [ ] `T9.1-07` - `GetLiveWorkoutStateUseCase` (`mode: 'live'`, `onlyExerciseIds`) and composition wiring (`workout-tracking.composition.ts`, remove `routineRepository`)
- [ ] `T9.1-08` - API endpoints plus `workout-api-errors.ts` and `workout-route-handlers.ts` (`PUT`/`DELETE` workouts, `active`, `live-state`, `exercise-context`, `exercise-order`, `workout-exercises`)
- [ ] `T9.1-09` - `live-workout.reducer.ts`, `live-workout.commands.ts`, `live-workout.selectors.ts` for the 9.1 actions, with table tests
- [ ] `T9.1-10` - `sync/outbox.ts` (`OutboxStore`, `MemoryOutboxStore`, contract suite), `sync/sync-worker.ts`, `use-live-workout.ts`
- [ ] `T9.1-11` - Components: `live-workout.tsx`, `workout-header.tsx`, `exercise-block.tsx` (menu, placeholder set list, notes, drag handle), `superset-bar.tsx`, `confirm-dialog.tsx`, sync banners; integrate `ExercisePicker` (add, replace)
- [ ] `T9.1-12` - `start-workout-button.tsx` and `start-workout-client.ts`; replace the form posts in the dashboard, `/train` and routine lists
- [ ] `T9.1-13` - Rewrite `src/pages/workout/[id].astro`; delete `exercise-card.astro`, `auto-save.ts`, `routine.repository.ts` + implementations and `POST /api/workouts`; fix imports
- [ ] `T9.1-14` - Tests: mothers, use cases, repositories, reducer, sync worker, route handlers, Supabase RLS/RPC, Phase 1 fixture regression
- [ ] `T9.1-15` - Update docs: mark context Use Cases rows `implemented` (the 9.1 rows), fix any doc/code drift found (layout file name, provider port files), add Implementation Evidence

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/workout-tracking/workout-skeleton.test.ts` | unit (table) | Plan, repeat and empty skeletons; warm-up rows before working rows; client vs server ids (01, 02) |
| `tests/workout-tracking/superset.test.ts` | unit (table) | Contiguity, single-member dissolve, move out of group (12) |
| `tests/workout-tracking/start-workout-v2.use-case.test.ts` | use-case | 4 modes, replay, in-progress conflict, `discardInProgress`, foreign routine, unusable exercise, limits (01–05) |
| `tests/workout-tracking/repeat-workout.use-case.test.ts` | use-case | Source rules and copy (02) |
| `tests/workout-tracking/get-active-workout.use-case.test.ts` | use-case | Active, none (06) |
| `tests/workout-tracking/session-exercises.use-case.test.ts` | use-case | Add, remove, reorder, replace, superset, notes; ownership `403`; dense positions (08–12) |
| `tests/workout-tracking/discard-workout.use-case.test.ts` | use-case | Cascade, idempotent, ownership, completed rejected (14) |
| `tests/workout-tracking/get-live-workout-state.use-case.test.ts` | use-case | Prop shape, routine notes and rep-range matching, empty slices, owner check (07) |
| `tests/workout-tracking/sqlite-workout.repository.v2.test.ts` | repo | `createFromSkeleton` atomicity, unique-index race, `findAggregate` live rows (03, 04) |
| `tests/workout-tracking/live-workout.reducer.test.ts` | unit (table) | One row per 9.1 action, expected state and commands, purity (12, 13, 15) |
| `tests/workout-tracking/live-workout.selectors.test.ts` | unit | `selectTotals` with an injected clock (13) |
| `tests/workout-tracking/sync-worker.test.ts` | unit (fake transport) | Ordering, 2xx/4xx/5xx/401, backoff (16) |
| `tests/workout-tracking/memory-outbox.store.test.ts` | contract | `OutboxStore` contract suite (16) |
| `tests/workout-tracking/workout-route-handlers.test.ts` | integration (real SQLite) | Status codes, `403`, `404`, `422` bodies, idempotent replays (03–06, 08, 14) |
| `tests/supabase/workout-session-rpc.integration.test.ts` | integration-RLS | Non-owner cannot start, upsert or delete on another user's workout (17) |
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` | regression | Phase 1 fixture still renders and opens (19) |
| manual checklist in Implementation Evidence (360 px screenshots, start → add → superset → discard on both backends) | manual | Island hydration, tap targets, no horizontal scroll (07, 18, 20) |

## Out of Scope

- Set rows, set types, Previous, RPE, rest timer, cardio inputs → [story-9.2](./story-9.2.md).
- *Terminar*, finish dialog, summary v2, edit mode, delete of completed workouts, *Repetir* button, save as routine → [story-9.3](./story-9.3.md).
- `TabBar` and `InProgressBanner` in the layout → [story-9.4](./story-9.4.md).
- Warm-up generator and plate calculator → [story-9.5](./story-9.5.md).
- Real suggestions, PR baselines, readiness step → stories 10.2, 10.1, 10.4.
- IndexedDB outbox, service worker, offline start, tombstones → [story-12.3](../round-12/story-12.3.md).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
