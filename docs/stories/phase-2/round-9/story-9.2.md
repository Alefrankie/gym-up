---
story_id: "9.2"
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
  prd_requirements: ["FR-WT-027", "FR-WT-028", "FR-WT-029", "FR-WT-030", "FR-WT-031", "FR-WT-032", "FR-WT-033", "FR-WT-034", "FR-WT-043"]
  architecture_decisions: ["ADR-015", "ADR-016"]
  flows: ["live-workout.flow.md"]
blocked_by: ["story-9.1"]
blocks: ["story-9.3", "story-9.5", "story-10.2"]
---

# Story 9.2 — Set rows v2, Previous, RPE, per-exercise rest timer, cardio

Parent: [../readme.md](../readme.md)

## Summary

Turns the exercise blocks of the live island into real logging: metric inputs by `exercise_type`, set types, the *Anterior* column, optional RPE, add and delete sets, prefill priority, validation on check, and the per-exercise rest timer driven by an absolute `endsAt`. Cardio is just exercises of type `duration` / `distance_duration` and needs no extra screen. Replaces `rest-timer.tsx`, `rest-timer.css`, `POST /api/workout-entries` and `LogSetUseCase`. Closes Hevy rows H3 (superset rest rule), H4, H5, H6, H7, H8 and H9 (live volume and sets).

## Files in scope

**Modify**

- `src/components/live-workout/live-workout.reducer.ts`, `live-workout.commands.ts`, `live-workout.selectors.ts` — add the set, timer and `exercise/rest-changed` actions.
- `src/components/live-workout/exercise-block.tsx` — replace the 9.1 placeholder set list with `SetRow`s, column headers by type, *+ Añadir serie*, rest value in the header; `live-workout.tsx` — mount `RestTimerBar` and `CardioHint`; `use-live-workout.ts` — coalesce `upsert-set` per set id within 500 ms.
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` (+ SQLite and Supabase implementations) — add `findLastCompletedSetsByExercise`; remove Phase 1 `addEntry`, `updateEntry` and `WorkoutEntryPatch` once nothing references them.
- `src/lib/contexts/workout-tracking/application/get-live-workout-state.use-case.ts` and the `exercise-context` handler — fill `previous` through `GetPreviousValuesUseCase`.
- `src/lib/contexts/workout-tracking/application/update-workout-exercise.use-case.ts` — validate `restSeconds` ∈ [0, 600].
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts`.
- `tests/workout-tracking/sqlite-workout.repository.test.ts` — drop the `addEntry` / `updateEntry` cases.

**Create**

- Pure modules: `src/lib/contexts/workout-tracking/domain/previous-set.ts` (`pickPreviousSet`); `src/lib/units/units.ts` (`kgToDisplay`, `displayToKg`, `mToDistanceDisplay`, `distanceDisplayToM`, `formatDuration`, `parseDuration`; pure, ADR-006); `src/components/live-workout/live-workout.prefill.ts` (`computePrefill`); `src/components/live-workout/format-metrics.ts` (display strings for `PreviousCell` and inputs); `src/components/live-workout/rest-timer-effects.ts` (vibration, beep, notification, permission flag; injectable environment).
- Application: `upsert-set.use-case.ts`, `delete-set.use-case.ts`, `get-previous-values.use-case.ts`.
- API: `src/pages/api/workout-sets/[id].ts` (PUT, DELETE).
- Components (`src/components/live-workout/`): `set-row.tsx`, `metric-inputs.tsx` (weight, reps, `mm:ss` duration, distance, RPE select), `set-type-menu.tsx`, `previous-cell.tsx`, `rest-timer-bar.tsx`, `use-rest-timer.ts`, `cardio-hint.tsx`.
- Tests: see [Test Plan](#test-plan); mother `workout-set.mother.ts` is reused from 7.1.

**Delete**

- `src/components/rest-timer.tsx`, `src/styles/rest-timer.css`, `src/pages/api/workout-entries.ts`.
- `src/lib/contexts/workout-tracking/application/log-set.use-case.ts` and `tests/workout-tracking/log-set.use-case.test.ts`.

**Not in scope** (must not change): `db/`, `supabase/migrations/` (the `upsert_workout_set` RPC and `set-metrics.ts` / `set-label.ts` ship in 7.1); `complete-workout.use-case.ts`, `workout-summary.astro` (9.3).

## Decisions

- `validateSetMetrics` and `deriveSetLabels` come from 7.1 and are imported as is. The reducer validates on `set/checked`; `UpsertSetUseCase` validates again on the server.
- Distance unit follows `weight_unit`: kg users see km (and m for `weight_distance`), lbs users see mi (and yd). There is no separate distance setting. (Simplest; Hevy has one.) Storage is metres: 1 mi = 1609.344 m, 1 yd = 0.9144 m. Weight lb → kg uses `0.45359237` and is stored unrounded ([ADR-006](../../../architecture/decisions/006-kg-storage.md)).
- Suggestion prefill applies to every non-warm-up row of the exercise (`weight`, `reps` or `durationSeconds`); `Suggestion.sets` is ignored here because the set count comes from the plan (readiness-based set changes belong to 10.4). Warm-up rows prefill from *Anterior* only. The suggestion branch is exercised with state fixtures until 10.2 wires the real port.
- Timer notification permission is requested once, at the first timer start, with the flag kept in `localStorage` inside try/catch. The end-of-rest sound is a 150 ms 880 Hz beep from the Web Audio API (no audio asset).
- Rest `−15 s` clamps at 0 (which finishes the timer); `+15 s` clamps at `MaxRestSeconds` (600).
- `CardioHint` shows "Calentamiento: 5–10 min caminando · Enfriamiento: 15–30 min caminando" ([FR-WT-015](../../../prd/features/workout-tracking.md#fr-wt-015)) only when the workout has a `routineDayId` and no exercise whose primary muscle is `cardio`; it can be dismissed for the session (local state, not persisted).
- Swipe-left *Eliminar* uses pointer events (no gesture library), with the row menu as the accessible alternative.

## Happy Path

1. The island opens a routine workout. Each exercise renders column headers for its type ([FR-WT-027](../../../prd/features/workout-tracking.md#fr-wt-027)) and rows prefilled in muted style: suggestion, else *Anterior*, else the "8–12" placeholder ([FR-WT-030](../../../prd/features/workout-tracking.md#fr-wt-030)).
2. User taps the set number and picks **Calentamiento (W)**; the label becomes `W` and the remaining normal sets keep their own ordinals ([FR-WT-028](../../../prd/features/workout-tracking.md#fr-wt-028)).
3. User taps the *Anterior* cell ("60 kg × 10") and the values copy into the row ([FR-WT-029](../../../prd/features/workout-tracking.md#fr-wt-029)).
4. With RPE enabled, user picks 8.5 in the selector ([FR-WT-031](../../../prd/features/workout-tracking.md#fr-wt-031)).
5. User taps ✓. The reducer validates, marks the set `completed` with `completedAt = at`, emits `upsert-set` and starts the exercise's rest timer ([FR-WT-033](../../../prd/features/workout-tracking.md#fr-wt-033)). The header volume and set count update in the same render.
6. `RestTimerBar` counts down from `endsAt`; user taps +15 s, edits the value in the bar (`exercise/rest-changed` → `update-exercise`) or taps *Saltar*. At 0 the phone vibrates, a beep plays and a notification fires if allowed ([FR-WT-034](../../../prd/features/workout-tracking.md#fr-wt-034)).
7. In a superset, checking a set of A1 starts no timer; checking a set of the last member starts it ([FR-WT-025](../../../prd/features/workout-tracking.md#fr-wt-025)).
8. User taps *+ Añadir serie* (copies the last set's values and type), swipes a row left to delete it ([FR-WT-032](../../../prd/features/workout-tracking.md#fr-wt-032)).
9. For a Treadmill entry the row shows *Distancia · Tiempo* ([FR-WT-043](../../../prd/features/workout-tracking.md#fr-wt-043)); the same workout can mix cardio and lifts, or be cardio only.

## Acceptance Criteria

- AC-9.2-01: Row inputs and column headers follow `exercise_type`: `weight_reps` Peso · Reps; `bodyweight_reps` Reps; `weighted_bodyweight` +Peso · Reps; `assisted_bodyweight` −Peso · Reps (shown "−20 kg", stored −20); `duration` Tiempo; `distance_duration` Distancia · Tiempo; `weight_distance` Peso · Distancia. Forbidden fields are not rendered. Weight and distance use `inputmode="decimal"`, reps and seconds `"numeric"`.
- AC-9.2-02: Duration input accepts `mm:ss` (and plain seconds) and stores seconds; distance is typed in km/mi (m/yd for `weight_distance`) and stored in metres; lb weights are stored in kg at full precision. Table tests cover `units.ts` round trips.
- AC-9.2-03: The set-type menu offers **Normal**, **Calentamiento (W)**, **Drop set (D)**, **Al fallo (F)**. Labels are `W`, `D`, `F` and the ordinal among normal sets; `set_number` still counts every set. `set/type-changed` emits one `upsert-set`.
- AC-9.2-04: *Anterior* shows the same-position completed set of the user's most recent completed workout containing the exercise (excluding the current one, any set type); if that workout had fewer sets the last one is used; no history shows "—". Formats: "60 kg × 10", "0:45", "2.5 km · 12:30". Tapping copies the values (`set/previous-copied` → `upsert-set`).
- AC-9.2-05: Prefill priority at initialization and on `exercise/added`: suggestion (when `progressionEnabled` and a suggestion exists) → *Anterior* → empty with the routine's rep range placeholder. Prefill renders muted, is not persisted until edited or checked, and editing one field clears only that field's prefill. Table tests cover each branch.
- AC-9.2-06: The RPE selector (6 to 10, step 0.5) appears only when `rpeEnabled`, is optional, persists with the set, and the server accepts RPE regardless of the setting. RPE 5.5 or 10.5 returns `400`.
- AC-9.2-07: *+ Añadir serie* copies the last set's values and type into a new unchecked row (new id, `setNumber + 1`) and is hidden at 20 sets; the server rejects the 21st with `422 limit_exceeded`. Deleting a set (swipe or menu) renumbers the rest `1..n` and emits `delete-set`; deleting a completed set updates header totals.
- AC-9.2-08: ✓ on a set that fails `validateSetMetrics` does not complete it: the row shakes (200 ms), `invalidFields` highlights the missing inputs, no command is emitted and no timer starts. A valid check sets `completed` and `completedAt = at`, emits `upsert-set`, starts the timer and runs PR detection hooks (a no-op with empty baselines until 10.1). Unchecking reverts both fields. `completed ⇔ completedAt` always holds.
- AC-9.2-09: Rest resolves as `exercise.restSeconds ?? settings.defaultRestSeconds`; `0` starts no timer. A new check replaces a running timer. `−15 s` / `+15 s` move `endsAt`; editing the value in the bar dispatches `exercise/rest-changed` for the rest of the session and emits `update-exercise { kind: 'details', restSeconds }`.
- AC-9.2-10: In a superset the timer starts only when the checked set belongs to the last exercise (by position) of its group; table test in the reducer test.
- AC-9.2-11: `useRestTimer` computes remaining seconds from the absolute `endsAt` every 250 ms and on `visibilitychange`; a test with an injected clock advancing 60 s without ticks shows the correct remaining time and fires the end effects once. At 0: `navigator.vibrate([200, 100, 200])` when supported, the beep, a Web Notification when permission was granted, then `timer/finished`. Permission is requested once at the first timer start.
- AC-9.2-12: Cardio: a `distance_duration` exercise (Treadmill) and a `duration` exercise can be added to a routine workout or used alone in an empty workout, log completed sets with the right columns, and add nothing to volume (`weight × reps`). `CardioHint` follows the decision above.
- AC-9.2-13: `PUT /api/workout-sets/[id]` is an idempotent upsert: `created`, `updated` or `stale` (older `updatedAt` than stored changes nothing) with `200`/`201`; copies `workoutId` and `exerciseId` from the parent exercise; a completed set without `completedAt` gets `updatedAt`; invalid metrics return `400 { error: 'validation', details }`; unknown parent `404`; another user's workout `403`; limit `422`. `DELETE /api/workout-sets/[id]?updatedAt=` removes the set and renumbers, a replay returns `200`.
- AC-9.2-14: `GET /api/workouts/[id]/exercise-context` and the island prop now include `previous` for added exercises and for the session; archived exercises still accept sets.
- AC-9.2-15: Both backends pass the same `UpsertSetUseCase`, `DeleteSetUseCase` and `GetPreviousValuesUseCase` tests. Supabase: as a non-owner, `upsert_workout_set` and deletes on another user's sets fail.
- AC-9.2-16: Phase 1 regression: Phase 1 completed sets (backfilled as `normal`, fractional weights allowed) appear as *Anterior* in a new session, and history and progress numbers for the Phase 1 fixture are unchanged.
- AC-9.2-17: `rest-timer.tsx`, `rest-timer.css`, `POST /api/workout-entries`, `LogSetUseCase`, `addEntry` and `updateEntry` no longer exist and nothing imports them. Checking a set updates the UI in < 100 ms with the network unreachable (NFR-WT-P2-02) and every control keeps ≥ 44 px at 360 px (NFR-WT-P2-04).

## Tasks

- [ ] `T9.2-01` - `units.ts` (weight, distance, duration conversions and formatting) with table tests
- [ ] `T9.2-02` - `previous-set.ts` (`pickPreviousSet`) and `live-workout.prefill.ts` (`computePrefill`) with table tests
- [ ] `T9.2-03` - `WorkoutRepository.findLastCompletedSetsByExercise` (abstract class, SQLite, Supabase) and `GetPreviousValuesUseCase`; wire `previous` into `GetLiveWorkoutStateUseCase` and `exercise-context`
- [ ] `T9.2-04` - `UpsertSetUseCase` and `DeleteSetUseCase` over `WorkoutExerciseRepository.upsertSet` / `removeSet` (typed errors, limits, rest validation in `UpdateWorkoutExerciseUseCase`)
- [ ] `T9.2-05` - `src/pages/api/workout-sets/[id].ts` plus route-handler cases in `workout-route-handlers.ts`
- [ ] `T9.2-06` - Reducer, commands and selectors for `set/*`, `timer/*` and `exercise/rest-changed`, including the superset timer rule and `use-live-workout` coalescing
- [ ] `T9.2-07` - `rest-timer-effects.ts` and `use-rest-timer.ts` with an injectable clock and environment
- [ ] `T9.2-08` - `metric-inputs.tsx`, `set-row.tsx` (shake, prefill style, swipe delete), `set-type-menu.tsx`, `previous-cell.tsx`
- [ ] `T9.2-09` - `rest-timer-bar.tsx`, `cardio-hint.tsx`; update `exercise-block.tsx` and `live-workout.tsx`
- [ ] `T9.2-10` - Delete `rest-timer.tsx`, `rest-timer.css`, `workout-entries.ts`, `log-set.use-case.ts` and `addEntry` / `updateEntry`; fix imports and tests
- [ ] `T9.2-11` - Tests: reducer rows, use cases, repositories, timer, route handlers, Supabase RLS/RPC, Phase 1 regression
- [ ] `T9.2-12` - Update docs: mark context Use Cases rows `implemented` (the 9.2 rows), fix any doc/code drift found (lb conversion constant `2.20462` in Phase 1 pages vs `0.45359237`), add Implementation Evidence

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/workout-tracking/units.test.ts` | unit (table) | kg/lb, km/mi, m/yd, `mm:ss` parse and format, round trips (02) |
| `tests/workout-tracking/previous-set.test.ts` | unit (table) | Same position, fewer sets uses last, none (04) |
| `tests/workout-tracking/live-workout.prefill.test.ts` | unit (table) | Suggestion → Anterior → placeholder, warm-up rows, per-field clearing (05) |
| `tests/workout-tracking/live-workout.reducer.test.ts` | unit (table) | One row per 9.2 action: state, commands, invalid check, timer rest resolution, replace on new check, superset rule, uncheck (03, 07–10) |
| `tests/workout-tracking/live-workout.selectors.test.ts` | unit | Volume `Σ max(0, weight) × reps`, cardio adds 0 (12) |
| `tests/workout-tracking/use-rest-timer.test.ts` | unit (injected clock) | Remaining from `endsAt`, 60 s sleep, effects fire once, permission once (11) |
| `tests/workout-tracking/upsert-set.use-case.test.ts` | use-case | Created, updated, stale, validation per type, limit, completedAt rule, `WorkoutOwnershipError` (06, 13) |
| `tests/workout-tracking/delete-set.use-case.test.ts` | use-case | Renumber, replay, ownership (07, 13) |
| `tests/workout-tracking/get-previous-values.use-case.test.ts` | use-case | Most recent workout, excludes current, any set type, archived exercises (04, 14) |
| `tests/workout-tracking/sqlite-workout.repository.test.ts` | repo | `findLastCompletedSetsByExercise` ordering and exclusion (04) |
| `tests/workout-tracking/workout-route-handlers.test.ts` | integration (real SQLite) | `workout-sets` status codes and bodies (13) |
| `tests/supabase/workout-set-rpc.integration.test.ts` | integration-RLS | Non-owner cannot upsert or delete another user's sets (15) |
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` | regression | Phase 1 sets as Anterior; numbers unchanged (16) |
| manual checklist in Implementation Evidence (360 px: treadmill, bodyweight, warm-up and drop sets, lock phone 60 s during rest) | manual | Inputs per type, shake, swipe delete, timer after lock, tap targets (01, 08, 11, 17) |

## Out of Scope

- Finish dialog, summary, edit and delete of completed workouts → [story-9.3](./story-9.3.md).
- Plate calculator button on the weight input and *Añadir calentamiento* → [story-9.5](./story-9.5.md) (the `exercise/warmups-added` action ships there).
- Real suggestions and the chip → [story-10.2](../round-10/story-10.2.md); PR badges → [story-10.1](../round-10/story-10.1.md); readiness adjustments → story 10.4.
- Offline durability of timer state and sets → [story-12.3](../round-12/story-12.3.md).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
