---
story_id: "11.2"
round: "round-11"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/progress/readme.md"
size: "L"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progress", "exercise-library", "body-metrics"]
  prd_requirements: ["FR-PR-012", "FR-PR-013", "FR-PR-014", "FR-PR-015", "FR-PR-016", "FR-PR-017", "NFR-PR-P2-01"]
  architecture_decisions: ["ADR-020"]
  flows: ["view-exercise-stats.flow.md"]
blocked_by: ["story-10.1", "story-11.1"]
blocks: ["story-11.4"]
---

# Story 11.2 — Statistics v2

Parent: [../readme.md](../readme.md)

## Summary

Gives the user Hevy's statistics tab. The exercise detail page gains *Gráficas* and *Historial* (next to *Récords* from 10.1); `/progress` is rebuilt around a 12-week overview (workouts, duration, volume, sets), muscle distribution with 20-sets/week flags, a month calendar with deload days and the weekly streak next to the Phase 1 day streak. Bodyweight volume uses `BodyWeightPort` (FR-BM-007). Every aggregate is a read model over existing tables (no new table, no migration). Closes Hevy parity rows **H17** and **H18** and verifies NFR-PR-P2-01.

Context: [progress readme → Phase 2](../../../architecture/contexts/progress/readme.md#phase-2) · Flow: [view-exercise-stats.flow.md](../../../architecture/contexts/progress/flows/view-exercise-stats.flow.md) · PRD: [FR-PR-012..017](../../../prd/features/progress.md#fr-pr-012), [NFR-PR-P2-01](../../../prd/features/progress.md#nfr-pr-p2-01) · Components: [Progress v2](../../../architecture/components.md#progress-v2).

## Files in scope

**Modify**

- `src/lib/contexts/progress/domain/progress.constants.ts` — add `StatsRanges`, `DistributionPeriods`, `StatsRules`, `ChartMetricsByType`, `ChartMetricLabels`.
- `src/lib/contexts/progress/domain/stats.types.ts` (story 10.1) — append `StatsRange`, `DistributionPeriod`, `ChartMetric`, `ChartPoint`, `ExerciseCharts`, `ExerciseSession`, `WeekBucket`, `WeeklyOverview`, `MuscleShare`, `CalendarMonthDay`, `CalendarMonth`, `WeeklyStreak`.
- `src/lib/contexts/progress/domain/ports/stats-query.repository.ts` + `infrastructure/sqlite/sqlite-stats-query.repository.ts` + `infrastructure/supabase/supabase-stats-query.repository.ts` — add `findExerciseSessionPage` and `countExerciseSessions`.
- `src/lib/contexts/progress/progress.composition.ts` — export the six new use cases (Phase 1 exports untouched).
- `src/pages/progress.astro` — sections in order: *Resumen* (`WeeklyBarsChart`), *Distribución muscular*, *Calendario* (`MonthCalendar`), *Rachas*, then the Phase 1 exercise selector + chart with "Ver detalle" → `/exercises/[id]?tab=graficas`. Section 1 (*Resumen semanal*) is added by story 11.4.
- `src/pages/exercises/[id].astro` (story 7.3) — add *Historial* and *Gráficas* tabs (`?tab=historial|graficas`, `?page=`) beside *Récords*.
- `src/pages/profile/index.astro` (story 9.4) — show "{n} semanas seguidas" from `calculateWeeklyStreakUseCase` ([FR-WT-045](../../../prd/features/workout-tracking.md#fr-wt-045)), replacing the Phase 1 day-streak fallback.

**Create**

- Domain (`src/lib/contexts/progress/domain/`): `stats.ts` (`setVolume`, `isoWeekStart`, `weeklyOverview`, `muscleDistribution`, `monthCalendar`, `weeklyStreak`, `exerciseChartSeries`), `ports/stats-profile.port.ts`.
- Application (`.../application/`): `get-exercise-charts.use-case.ts`, `get-exercise-session-history.use-case.ts`, `get-weekly-overview.use-case.ts`, `get-muscle-distribution.use-case.ts`, `get-month-calendar.use-case.ts`, `calculate-weekly-streak.use-case.ts`.
- Infrastructure: `sqlite/sqlite-stats-profile.adapter.ts`, `supabase/supabase-stats-profile.adapter.ts` (`weight_unit`, `timezone`, `days_per_week`).
- UI (`src/components/progress/`): `exercise-charts-panel.tsx`, `exercise-session-list.astro`, `weekly-bars-chart.tsx`, `muscle-distribution-chart.tsx`, `month-calendar.astro`, `weekly-streak-counter.astro`.
- API: `src/pages/api/progress/exercises/[exerciseId]/charts.ts` (GET `?range=`), `src/pages/api/progress/muscle-distribution.ts` (GET `?period=`).
- Tests and mothers: see [Test Plan](#test-plan).

**Not in scope (must not change):** `GetCalendarDataUseCase` and `calendar-grid.astro` (kept for regression, no longer rendered on `/progress`), `CalculateStreakUseCase`, the `/history` page (story 9.3), `body_measurements`, any schema.

## Happy Path

1. On `/progress` the user sees *Resumen*: four bar charts (Entrenamientos, Duración, Volumen, Series) for the last 12 ISO weeks; tapping a bar lists that week's workouts ([FR-PR-014](../../../prd/features/progress.md#fr-pr-014)). Without any body weight and with bodyweight sets present the hint "Registra tu peso para incluir ejercicios con peso corporal" shows ([FR-BM-007](../../../prd/features/body-metrics.md#fr-bm-007)).
2. *Distribución muscular* shows sets per muscle (primary 1, secondary 0.5, working sets only) for 7 d / 30 d / 3 m, sorted descending, with the Δ vs the previous equal period and a ⚠ flag above 20 sets/week ([FR-PR-015](../../../prd/features/progress.md#fr-pr-015)); the toggle calls `GET /api/progress/muscle-distribution?period=`.
3. *Calendario* shows the current month with ‹ › links (`?month=YYYY-MM`), dots on workout days, deload days in a distinct colour, and a day with workouts expands to its list ([FR-PR-016](../../../prd/features/progress.md#fr-pr-016)).
4. *Rachas* shows the Phase 1 day streak and "{n} semanas seguidas" ([FR-PR-017](../../../prd/features/progress.md#fr-pr-017)); `/profile` shows the weekly streak.
5. From "Ver detalle" the user opens `/exercises/[id]?tab=graficas`: metric tabs from `ChartMetricsByType`, ranges 30 d / 3 m / 1 a / todo, one point per workout, SSR initial data and `GET /api/progress/exercises/[exerciseId]/charts?range=` on range change ([FR-PR-012](../../../prd/features/progress.md#fr-pr-012)).
6. `?tab=historial` lists every session of the exercise, newest first, 20 per page, with set labels (W, D, F, 1…n) and 🏆 badges ([FR-PR-013](../../../prd/features/progress.md#fr-pr-013)).
7. All pages use the viewer's own data (also for a family member's custom exercise).

## Decisions

- **Weekly streak consumers.** `/profile` (FR-WT-045) is wired here. The member card (FR-PV-008) belongs to story 12.1 per the public-view readme ("`CalculateMemberStatsUseCase` (extended) … 12.1"); this story exports `calculateWeeklyStreakUseCase` from `progress.composition.ts` so 12.1 injects it, and a parity test proves the number is the same for the same data (see report note on the phase brief).
- **Volume rules.** Weekly volume uses body weight per FR-BM-007 (`setVolume`); per-exercise charts and records use the logged (added) weight. Distance-type sets add 0 volume. Sets/week and volume count every completed non-warm-up set; muscle distribution counts working sets only (`normal`, `failure`).
- **Weekly bar tap list.** `WeekBucket` carries `workoutIds`; the use case also returns a `workoutLabels` map (`id → { name, date }`) from `findWorkoutsByIds` so the island can list names and link to `/workouts/[id]`.
- **Muscle Δ.** The chart shows a percentage derived from `MuscleShare.delta / previous` (hidden when `previous = 0`); components.md names the prop `deltaPct`, the types carry `previous` and `delta`.
- **Weeks and dates** are ISO Monday-based and computed in `profiles.timezone`; reuse the local-date helper of 11.1 (`localDateKey`).
- **Empty states.** Every tab and chart shows "Aún no has registrado este ejercicio" or an equivalent empty state, never an error.
- **Perf test lives here** because all three read paths (records 10.1, charts and history 11.2) exist only now.
- **`StatsProfilePort` / `StatsQueryRepository`.** If story 9.3 already created either for `GetHistoryUseCase`, extend instead of recreating.

## Acceptance Criteria

- AC-11.2-01: `ChartMetricsByType` drives the *Gráficas* tab: `weight_reps` / `weighted_bodyweight` → Peso máximo, Mejor 1RM, Mejor serie (volumen), Volumen de sesión, Reps totales; `bodyweight_reps` / `assisted_bodyweight` → Reps máximas, Reps totales; `duration` → Duración máxima, Duración total; `distance_duration` → Distancia, Duración, Ritmo; `weight_distance` → Peso máximo, Distancia (round AC-R11-02).
- AC-11.2-02: `exerciseChartSeries` returns one point per workout (local date of `completedAt`): max weight, max e1RM, max weight × reps, Σ weight × reps, Σ reps, max reps, durations, Σ distance, pace = Σ duration / Σ distance × 1000 s/km (5,000 m in 1,500 s → 300 s/km); ranges 30 d / 3 m / 1 a / todo filter by `since`.
- AC-11.2-03: *Historial* lists sessions newest first, 20 per page (`?page=`), each with date, workout name and sets labelled `W`, `D`, `F`, `1…n` with 🏆 badges consistent with story 10.1; values in the user's unit; an exercise with no sessions shows the empty state.
- AC-11.2-04: `setVolume`: `weight_reps` 100 × 5 → 500; `weighted_bodyweight` bw 80 + 20 × 8 → 800; `bodyweight_reps` bw 80 × 10 → 800; `assisted_bodyweight` bw 80, −30 × 8 → 400; `duration` / `distance_duration` / `weight_distance` → 0; a warm-up set → 0; no body weight → bodyweight types 0.
- AC-11.2-05: `weeklyOverview` returns exactly 12 buckets (oldest first, ending with the current ISO week) with workouts, duration (Σ completedAt − startedAt), volume, sets and `workoutIds`; `missingBodyWeight` is true only when bodyweight-type sets exist and no body weight is logged, and the hint shows.
- AC-11.2-06: ISO weeks follow `profiles.timezone`: a workout completed at 2026-09-27T23:30:00Z for a user in `Europe/Madrid` belongs to the week starting 2026-09-28; Sunday 2026-09-27 belongs to the week starting 2026-09-21.
- AC-11.2-07: `muscleDistribution` weights primary 1.0 and each secondary 0.5 over `normal` and `failure` sets (10 chest sets with secondary triceps and shoulders → chest 10, triceps 5, shoulders 5), excludes warm-ups, sorts by sets descending, computes `previous` from the equal period before, `perWeek = sets / (days / 7)` and `flagged` only above 20 (21 flagged, 20 not).
- AC-11.2-08: `monthCalendar` groups completed workouts by local date, `isDeload` is true when any workout of the day has `is_deload`; a workout completed at 2026-10-01T02:00:00Z in `America/Bogota` appears on 2026-09-30; days without workouts are omitted; `?month=` navigates and an invalid value falls back to the current month.
- AC-11.2-09: `weeklyStreak` with target 4: current week 2, previous weeks 4, 5, 3 → 2 weeks (starts at the previous week); current week 4 → 3 weeks; `days_per_week` unset → target 3; a current week that has not reached the target never breaks the streak.
- AC-11.2-10: `/progress` shows *Resumen*, *Distribución muscular*, *Calendario*, *Rachas* and the Phase 1 selector + chart with a "Ver detalle" link; the Phase 1 day streak is still shown next to "{n} semanas seguidas"; `/profile` shows the weekly streak; weekly bars, distribution and calendar match a hand-computed fixture (round AC-R11-03).
- AC-11.2-11: `calculateWeeklyStreakUseCase` is exported from `progress.composition.ts` and returns the same weeks as the member-card figure will use (parity test over one fixture); the member's `days_per_week` is never exposed.
- AC-11.2-12: `GET /api/progress/exercises/[exerciseId]/charts?range=` returns the series (404 for an unknown exercise, 401 without session) and `GET /api/progress/muscle-distribution?period=` returns `MuscleShare[]`; every endpoint takes the user id from the session.
- AC-11.2-13: NFR-PR-P2-01: with 5,000 sets over 250 workouts for one user, `GetPersonalRecordsUseCase`, `GetExerciseChartsUseCase` and `GetExerciseSessionHistoryUseCase` each stay under 300 ms p95 over 20 runs on SQLite.
- AC-11.2-14: Both backends (`STORAGE_BACKEND=sqlite|supabase`) return identical stats for the same fixture; Supabase stats queries rely on read-all workout tables and still filter `user_id` explicitly (no new RLS, no write path, so no non-owner write test applies).
- AC-11.2-15: Phase 1 regression: with `tests/fixtures/phase-1.db`, history, `/progress` chart points and streak return the same numbers; Phase 1 workouts (all `normal` sets) appear in the weekly overview, the calendar and the muscle distribution without error.

## Tasks

- [ ] `T11.2-01` - Constants (`StatsRanges`, `DistributionPeriods`, `StatsRules`, `ChartMetricsByType`, `ChartMetricLabels`) and the stats types in `stats.types.ts`.
- [ ] `T11.2-02` - `stats.ts` pure functions with table-driven tests (`setVolume` per type with and without body weight, ISO weeks across a timezone boundary, `weeklyStreak`, `muscleDistribution`, `monthCalendar`, `exerciseChartSeries` per type).
- [ ] `T11.2-03` - Extend `StatsQueryRepository` with `findExerciseSessionPage` and `countExerciseSessions` (SQLite then Supabase); add `StatsProfilePort` and both adapters.
- [ ] `T11.2-04` - `GetExerciseChartsUseCase` and `GetExerciseSessionHistoryUseCase` (PR badges through `GetWorkoutPrsUseCase`) with use-case tests.
- [ ] `T11.2-05` - `GetWeeklyOverviewUseCase` (uses `bodyWeightPort.listBodyWeights`), `GetMuscleDistributionUseCase` (`ExerciseCatalogPort` for muscles), `GetMonthCalendarUseCase`, `CalculateWeeklyStreakUseCase` with use-case tests on real SQLite.
- [ ] `T11.2-06` - Composition exports; API `GET /api/progress/exercises/[exerciseId]/charts` and `GET /api/progress/muscle-distribution`.
- [ ] `T11.2-07` - `ExerciseChartsPanel` (Chart.js, metric tabs, ranges) and `ExerciseSessionList`; *Gráficas* and *Historial* tabs on `/exercises/[id]`.
- [ ] `T11.2-08` - `WeeklyBarsChart` (4 metrics, tap a bar, body-weight hint) and `MuscleDistributionChart` (period toggle, Δ, ⚠ flag).
- [ ] `T11.2-09` - `MonthCalendar` (`<details>` per day, deload colour, ‹ › links) and `WeeklyStreakCounter`; restructure `/progress`.
- [ ] `T11.2-10` - Wire the weekly streak into `/profile`; parity test for the exported use case.
- [ ] `T11.2-11` - `tests/progress/perf-5000-sets.test.ts` (NFR-PR-P2-01) and the Phase 1 regression and cross-backend checks.
- [ ] `T11.2-12` - Update docs: mark context Use Cases rows (`GetExerciseChartsUseCase`, `GetExerciseSessionHistoryUseCase`, `GetWeeklyOverviewUseCase`, `GetMuscleDistributionUseCase`, `GetMonthCalendarUseCase`, `CalculateWeeklyStreakUseCase`) `implemented`, fix any doc/code drift found (e.g. `deltaPct` vs `delta`), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/progress/stats.test.ts` | unit (pure, table-driven) | `setVolume`, ISO week boundaries, `weeklyStreak` (current met / not met, default 3), `muscleDistribution` weights and flag at 20 / 21, `monthCalendar` deload and timezone, `exerciseChartSeries` per type (02, 04–09) |
| `tests/progress/get-exercise-charts.use-case.test.ts` | use-case (real SQLite) | metrics per exercise type, ranges, empty state (01, 02) |
| `tests/progress/get-exercise-session-history.use-case.test.ts` | use-case | pagination 20, set labels, PR badges equal 10.1, empty (03) |
| `tests/progress/get-weekly-overview.use-case.test.ts` | use-case | 12 buckets, bodyweight volume via real `BodyWeightService`, hint (04–06) |
| `tests/progress/get-muscle-distribution.use-case.test.ts` | use-case | periods, previous Δ, secondary weights from the real catalog (07) |
| `tests/progress/get-month-calendar.use-case.test.ts`, `calculate-weekly-streak.use-case.test.ts` | use-case | month params, deload days, streak and parity for 12.1 (08, 09, 11) |
| `tests/progress/stats-hand-computed-fixture.test.ts` | integration | weekly bars, distribution and calendar equal a hand-computed fixture (10) |
| `tests/progress/progress-endpoints.test.ts` | integration | 401, 404, query validation (12) |
| `tests/progress/perf-5000-sets.test.ts` | perf (SQLite) | NFR-PR-P2-01 for the three read paths (13) |
| `tests/progress/phase-1-regression.test.ts` | integration | Phase 1 fixture numbers unchanged, Phase 1 data in new views (15) |
| `tests/supabase/stats-query.integration.test.ts` (extended) | integration (gated) | Supabase parity (14) |

Mothers: extend `WorkoutStatMother.completed({ daysAgo, isDeload? })`, `RecordSetMother`; add `StatsFixtureMother.weekWithBodyweightSets()` and `BodyWeightPointMother` in `tests/progress/mothers/`.

## Out of Scope

- The *Resumen semanal* AI card (`/progress` section 1) → story 11.4.
- Weekly streak on the member card (FR-PV-008) and PR counts on member cards → story 12.1.
- CSV export (`ExportWorkoutsCsvUseCase`) → story 12.4.
- Caching of stats (only if the NFR fails) → not in Phase 2.
- `deleted_at IS NULL` tombstone filter → story 12.3.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
