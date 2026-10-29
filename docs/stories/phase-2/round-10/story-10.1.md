---
story_id: "10.1"
round: "round-10"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/progress/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progress", "workout-tracking"]
  prd_requirements: ["FR-PR-008", "FR-PR-009", "FR-PR-010", "FR-PR-011"]
  architecture_decisions: ["ADR-020"]
  flows: ["live-pr-detection.flow.md"]
blocked_by: ["story-9.3"]
blocks: ["story-10.3", "story-11.2", "story-12.1", "story-12.2"]
---

# Story 10.1 — Personal Records Engine & PR Badges

Parent: [../readme.md](../readme.md)

## Summary

Ships Hevy's personal records: the pure `personal-records.ts` module ([ADR-020](../../../architecture/decisions/020-personal-records.md)), the real `RecordBaselinePort` adapter that replaces the Round 9 no-op, `PrCountPort`, the live 🏆 badge in the live-workout island, the PR list in the workout summary and the *Récords* tab (records table + rep-max table) on `/exercises/[id]`. Records are always derived from workout data: no table, no migration. Closes Hevy parity row **H16** (and the *Récords* part of **H17**) of the [phase exit criteria](../readme.md#exit-criteria--hevy--gravl-parity).

Context: [progress readme → Phase 2](../../../architecture/contexts/progress/readme.md#phase-2) · Flow: [live-pr-detection.flow.md](../../../architecture/contexts/progress/flows/live-pr-detection.flow.md) · PRD: [FR-PR-008..011](../../../prd/features/progress.md#fr-pr-008).

## Files in scope

**Modify**

- `src/lib/contexts/progress/domain/progress.constants.ts` — add `RecordRules`, `RecordTypes`, `RecordApplicability`, `LowerIsBetter`, `RecordLabels`.
- `src/lib/contexts/progress/progress.composition.ts` — append `getWorkoutPrsUseCase`, `getPersonalRecordsUseCase`, `recordBaselinePort`, `prCountPort` (Phase 1 exports untouched); wire `prCountPort` into `getHistoryUseCase` (story 9.3).
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — replace `NoRecordBaselineAdapter` with the progress `recordBaselinePort`.
- `src/components/live-workout/live-workout.reducer.ts` — run `detectPrsInSequence` on `set/checked`, `set/unchecked`, `set/changed`, `set/type-changed`, `set/removed`; keep the PRs of each set in state.
- `src/components/live-workout/set-row.tsx`, `src/components/live-workout/live-workout.tsx` — render `PrBadge`, toast + haptic once per `(setId, type)`.
- `src/components/workout-summary/workout-summary.tsx`, `src/pages/workout/[id].astro` — pass the real `prs` (story 9.3 passes `[]` and hides the *Récords* tile, [phase rule 7](../readme.md#7-forward-compatible-ui)).
- `src/components/progress/history-list.astro` (story 9.3) — show the PR count column when `prCount` is defined.
- `src/pages/exercises/[id].astro` (story 7.3) — add the *Récords* tab (`?tab=records`).
- `db/schema.ts` + `db/migrations/` — **only if** `idx_entries_exercise (exercise_id)` and `idx_workouts_completed (user_id, completed_at DESC) WHERE status='completed'` are missing from the SQLite migrations (task T10.1-01).

**Create**

- Domain (`src/lib/contexts/progress/domain/`): `personal-records.ts`, `stats.types.ts` (this story adds `WorkoutSetPr`; story 11.2 appends the rest), `ports/stats-query.repository.ts`, `ports/record-baseline.port.ts`, `ports/pr-count.port.ts`.
- Application (`.../application/`): `get-personal-records.use-case.ts`, `get-workout-prs.use-case.ts`, `record-baseline.service.ts` (`RecordBaselineService implements RecordBaselinePort`), `pr-count.service.ts` (`PrCountService implements PrCountPort`).
- Infrastructure: `.../infrastructure/sqlite/sqlite-stats-query.repository.ts`, `.../infrastructure/supabase/supabase-stats-query.repository.ts` (read-only).
- UI: `src/components/progress/pr-badge.tsx`, `src/components/progress/records-table.astro`, `src/components/progress/rep-max-table.astro`.
- API: `src/pages/api/progress/baselines.ts`, `src/pages/api/progress/workouts/[id]/prs.ts`, `src/pages/api/progress/records/[exerciseId].ts`.
- Tests: see [Test Plan](#test-plan).

**Not in scope (must not change):** Phase 1 `ProgressRepository`, `GetExerciseHistoryUseCase`, the `/progress` page, `calendar-grid.astro`; `workout_entries` / `workouts` columns; any `personal_records` table (none exists, ADR-020 §4).

## Happy Path

1. The user opens `/workout/[id]` for an in-progress workout. SSR calls `recordBaselinePort.getBaselines(userId, exerciseIds, { excludeWorkoutId: workoutId })`; the result goes into the island prop `prBaselines` ([FR-PR-009](../../../prd/features/progress.md#fr-pr-009)).
2. The user checks Bench Press set 2 (102.5 kg × 3). The reducer runs `detectPrsInSequence(baseline, setsOfThisExercise)` from the bundled `personal-records.ts`; set 2 gets `['heaviest_weight']`.
3. The row shows `PrBadge` "🏆 Peso máximo"; a toast ("¡Nuevo récord! Peso máximo: 102.5 kg") and `navigator.vibrate` fire once for that `(setId, type)`.
4. Later sets compete with earlier ones of the same workout (set 5 earns "Mejor serie" + "Mejor sesión"). Unchecking or lowering a set removes its badges without a toast.
5. The user finishes. The summary ([FR-WT-036](../../../prd/features/workout-tracking.md#fr-wt-036), [FR-PR-010](../../../prd/features/progress.md#fr-pr-010)) lists the PRs from `GetWorkoutPrsUseCase`, recomputed server-side with the same module.
6. The user opens `/exercises/[id]?tab=records`: `GetPersonalRecordsUseCase` feeds `RecordsTable` (value, date, link to `/workouts/[id]`) and, for `weight_reps`, `RepMaxTable` ([FR-PR-011](../../../prd/features/progress.md#fr-pr-011)).
7. `/history` shows the PR count per workout from `PrCountPort.countByWorkouts` (the column was hidden until now).

## Decisions

- **`e1rm()` home.** Story 9.5 (1RM calculator) already needs `e1rm()`; per the phase brief it lives in `src/lib/contexts/progress/domain/personal-records.ts`. This story extends that file with the rest of the module. If 9.5 placed the helper elsewhere, move it here and re-export it from the old path so the calculator keeps working. (Hevy has one shared formula.)
- **`StatsQueryRepository` ownership.** This story needs `findCompletedWorkouts`, `findSetsForWorkouts`, `findExerciseSets`, `findWorkoutsByIds`. If story 9.3 already created the file for `findHistoryPage` / `countHistory`, add only the missing methods; otherwise create it with these four. Story 11.2 adds `findExerciseSessionPage` / `countExerciseSessions`.
- **API of the island.** The island calls `detectPrsInSequence` (progress readme), not the `detectPrs(baseline, set)` named in the workout-tracking readme; the progress readme owns the module's final shape.
- **Récords tab visibility.** `exercise-library` renders no tab whose story has not shipped, so this story *adds* the tab rather than replacing a placeholder.
- **Null adapter.** `NoRecordBaselineAdapter` stays on disk (unused by the composition) so Round 9 tests that import it keep passing.
- **Live badge and `progression_enabled`.** PR badges are Hevy behaviour and ignore `progression_enabled` (FR-PG-013 only hides coach features).
- **Mid-workout baseline.** Besides `GET /api/progress/baselines`, the island may use the workout-tracking `exercise-context` endpoint; both delegate to the same port.

## Acceptance Criteria

- AC-10.1-01: `e1rm(100, 5)` = 116.67, `e1rm(100, 1)` = 100, `e1rm(60, 12)` = 84, and `e1rm(80, 13)` and `e1rm(80, 0)` are `null` ([ADR-020 §2](../../../architecture/decisions/020-personal-records.md)).
- AC-10.1-02: Given the Bench baseline `{ heaviest_weight: 100, best_1rm: 116.67, best_set_volume: 600, best_session_volume: 2400 }`, `detectPrsInSequence` over 100×5, 102.5×3, 90×8, 90×8, 80×10 returns `[]` for sets 1 and 4 (ties), `['heaviest_weight']` for set 2, `['best_set_volume']` for set 3 and `['best_set_volume', 'best_session_volume']` for set 5.
- AC-10.1-03: Unchecking set 5 (or lowering it below the record) yields no badges for it and no `best_session_volume`; a `warmup` set (120×10) never produces a badge or raises the baseline; `hasHistory: false` yields `[]` for every set.
- AC-10.1-04: `computeRecords` returns, for 100×5, 90×8, 80×10, a rep-max table with N 1–5 → 100, N 6–8 → 90, N 9–10 → 80 and N 11–12 omitted; ties keep the earlier holder; `best_session_volume` has `setId = null`.
- AC-10.1-05: For `assisted_bodyweight` (baseline `least_assistance: 30`, `most_reps: 8`) a set of −25 kg × 9 yields `['most_reps', 'least_assistance']`; for `distance_duration` 5,000 m in 1,500 s beats `best_pace: 0.32` s/m, while 300 m in 60 s yields no `best_pace` value.
- AC-10.1-06: Checking a set that beats the baseline shows the 🏆 badge with `RecordLabels[type]`, one toast and one haptic pulse for that `(setId, type)`; re-rendering, or unchecking and re-checking an unchanged value, does not announce twice; removal shows no toast ([FR-PR-009](../../../prd/features/progress.md#fr-pr-009)).
- AC-10.1-07: Detection makes no network call (works offline): the check path uses only the `prBaselines` already in state.
- AC-10.1-08: `RecordBaselineService.getBaselines` returns one entry per requested id (`hasHistory: false`, `best: {}` when never done), excludes `excludeWorkoutId`, and with `completedBefore` ignores later workouts (edit mode). The workout page now delivers non-empty `prBaselines`.
- AC-10.1-09: `GET /api/progress/baselines?exerciseIds=a,b&workoutId=…` returns the baselines for an exercise added mid-workout; the first-ever session of an exercise shows no badges; if the endpoint fails the exercise has no badges and the island does not retry.
- AC-10.1-10: The summary lists the workout's PRs (type label + value, exercise name) from `GetWorkoutPrsUseCase`; a first session lists none; editing a past workout and re-reading re-derives the list; PRs still count in a deload workout.
- AC-10.1-11: `PrCountService.countByWorkouts(ids)` returns a `Map<workoutId, count>` (missing id → 0) for any user's workout (read-all data), `listByWorkout(id)` is ordered by exercise position then set number, `countByUserSince(userId, since)` counts PRs of workouts completed at or after `since`; `/history` shows the count.
- AC-10.1-12: *Récords* lists only the record types applicable to the exercise type (`RecordApplicability`), values in the user's unit with 1RM rounded to 0.5 for display, each with date and link to `/workouts/[id]`; `RepMaxTable` appears only for `weight_reps`; an exercise with no sessions shows "Aún no has registrado este ejercicio".
- AC-10.1-13: Both backends: `STORAGE_BACKEND=sqlite` and `supabase` return identical records and PR lists for the same fixture; Supabase queries filter `user_id` explicitly and rely on read-all `workouts` / `workout_entries` / `workout_exercises` (no new RLS policy, no write path, so no non-owner write test applies).
- AC-10.1-14: `idx_entries_exercise` and `idx_workouts_completed` exist in the SQLite migrations (declared with `index()` in `db/schema.ts` when missing); `personal-records.ts` has only `import type` statements so the island bundle pulls no Drizzle or SQLite code.
- AC-10.1-15: Phase 1 regression: with `tests/fixtures/phase-1.db` (story 7.1) history, `/progress` chart points and streak return the same numbers, and `GetPersonalRecordsUseCase` over Phase 1 workouts (all `normal` sets) returns records without error. All three endpoints answer 401 without a session.

## Tasks

- [ ] `T10.1-01` - Check the SQLite migrations for `idx_entries_exercise` and `idx_workouts_completed`; add `index()` declarations plus a `drizzle-kit generate` migration if missing (mirror in `supabase/migrations/` as `CREATE INDEX IF NOT EXISTS`).
- [ ] `T10.1-02` - Constants in `progress.constants.ts`: `RecordRules`, `RecordTypes`, `RecordApplicability`, `LowerIsBetter`, `RecordLabels`.
- [ ] `T10.1-03` - `personal-records.ts`: types, `e1rm`, `isEligibleSet`, `setValue`, `beats`, `computeRecords`, `baselineFrom`, `detectPrs`, `applySetToBaseline`, `detectPrsInSequence`; table-driven tests from the worked examples (with `RecordSetMother`).
- [ ] `T10.1-04` - `stats.types.ts` (`WorkoutSetPr`) and the ports `StatsQueryRepository`, `RecordBaselinePort`, `PrCountPort` as in the progress readme.
- [ ] `T10.1-05` - `SqliteStatsQueryRepository` (`findCompletedWorkouts`, `findSetsForWorkouts`, `findExerciseSets` with `completedBefore` / `excludeWorkoutId` / `since`, `findWorkoutsByIds`); repo tests with real SQLite.
- [ ] `T10.1-06` - `SupabaseStatsQueryRepository` with the same method signatures (`workouts!inner(...)` filters like Phase 1 `SupabaseProgressRepository`).
- [ ] `T10.1-07` - `GetPersonalRecordsUseCase` and `GetWorkoutPrsUseCase` (`ExerciseCatalogPort.findByIds` for type and name) with use-case tests.
- [ ] `T10.1-08` - `RecordBaselineService` and `PrCountService`; tests (edit-mode `completedBefore`, owner batching, `countByUserSince`).
- [ ] `T10.1-09` - Composition: export the four new instances from `progress.composition.ts`; swap the null adapter in `workout-tracking.composition.ts`; wire `prCountPort` into `getHistoryUseCase`.
- [ ] `T10.1-10` - API: `/api/progress/baselines`, `/api/progress/workouts/[id]/prs`, `/api/progress/records/[exerciseId]` (401 without session, user id from the session).
- [ ] `T10.1-11` - `PrBadge`; reducer detection plus the per-`(setId, type)` announced set; toast + haptic in `live-workout.tsx`; badge in `set-row.tsx`.
- [ ] `T10.1-12` - Summary: load `getWorkoutPrsUseCase` in `/workout/[id].astro`, pass `prs`, show the *Récords* tile; `/history` PR count column.
- [ ] `T10.1-13` - `RecordsTable`, `RepMaxTable` and the *Récords* tab on `/exercises/[id]` (unit conversion at the page boundary, 1RM rounded to 0.5).
- [ ] `T10.1-14` - Gated Supabase parity test (`RUN_SUPABASE_INTEGRATION=true`) and the Phase 1 regression case.
- [ ] `T10.1-15` - Update docs: mark context Use Cases rows (`GetPersonalRecordsUseCase`, `GetWorkoutPrsUseCase`, `RecordBaselineService`, `PrCountService`) `implemented`, fix any doc/code drift found (e.g. `detectPrs` vs `detectPrsInSequence`), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/progress/personal-records.test.ts` | unit (pure, table-driven) | e1RM bounds, sequence replay, uncheck, warm-up, first exposure, rep-max, assisted, pace, every record type × applicable exercise type, ties (01–05) |
| `tests/progress/mothers/record-set.mother.ts`, `workout-stat.mother.ts` | Object Mothers | `RecordSetMother.set(weight, reps, { id?, setNumber?, setType?, completed?, workoutId? })`, `WorkoutStatMother.completed({ daysAgo })` |
| `tests/progress/sqlite-stats-query.repository.test.ts` | repo (real SQLite) | `completedBefore` / `excludeWorkoutId` bounds, read-all lookup (08, 11, 13) |
| `tests/progress/get-workout-prs.use-case.test.ts` | use-case | edit of a past workout re-derives PRs, deload PRs, first session (10) |
| `tests/progress/record-baseline.service.test.ts` | use-case | baseline excludes the current workout, every id present, edit mode (08, 09) |
| `tests/progress/pr-count.service.test.ts` | use-case | map, missing id, ordering, `countByUserSince` (11) |
| `tests/progress/get-personal-records.use-case.test.ts` | use-case | applicable types, rep-max only for `weight_reps`, empty state (12) |
| `tests/progress/live-pr-reducer.test.ts` | unit (reducer) | badge on check, none on uncheck, once-per-pair announcements, no network (06, 07) |
| `tests/progress/records-schema.test.ts` | integration (SQLite) | indexes exist, `personal-records.ts` has no runtime imports (14) |
| `tests/progress/phase-1-regression.test.ts` | integration | Phase 1 fixture numbers unchanged, records on Phase 1 data, 401 on endpoints (15) |
| `tests/supabase/stats-query.integration.test.ts` | integration (gated) | Supabase parity with the SQLite fixture (13) |

Worked-example tables to encode verbatim from the [progress readme](../../../architecture/contexts/progress/readme.md#phase-2): e1rm, sequence, uncheck, warm-up, first exposure, rep-max, assisted, pace, pace minimum distance.

## Out of Scope

- Weekly stats, charts, history tab, muscle distribution, calendar, weekly streak → story 11.2.
- PR cards on the feed, the detail page and the member card → story 12.1; PR line on the share image → story 12.2.
- Offline persistence of baselines and the outbox → story 12.3 (this story only keeps detection network-free).
- Tombstone filtering (`deleted_at IS NULL`) of set reads → story 12.3.
- Performance test for 5,000 sets → story 11.2 (`tests/progress/perf-5000-sets.test.ts`).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
