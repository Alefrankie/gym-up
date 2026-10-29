# View Exercise Stats Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-PR-011 … FR-PR-017](../../../../prd/features/progress.md#exercise-statistics)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [11.2](../../../../stories/phase-2/round-11/story-11.2.md) (records tab: [10.1](../../../../stories/phase-2/round-10/story-10.1.md)) |
| Decisions | [ADR-020](../../../decisions/020-personal-records.md), [ADR-002](../../../decisions/002-chartjs-react-island.md), [ADR-006](../../../decisions/006-kg-storage.md) |

## Happy Path

### Step 1 - Open an Exercise

From `/progress` ("Ver detalle"), the exercise library or a workout, the user opens `/exercises/[id]` (page owned by exercise-library, FR-EL-003). The tab comes from `?tab=` (`historial`, `graficas`, `records`; default *Cómo hacerlo*).

### Step 2 - Historial Tab

SSR calls `getExerciseSessionHistoryUseCase.execute({ userId, exerciseId, page })`. Every session with this exercise, newest first, 20 per page: date, workout name, sets with labels (`W`, `D`, `F`, `1…n`) and 🏆 badges. Values in the user's unit.

### Step 3 - Gráficas Tab

SSR calls `getExerciseChartsUseCase.execute({ userId, exerciseId, range: '3m' })` and hydrates `ExerciseChartsPanel`. Metrics depend on `exercise_type` (`ChartMetricsByType`), e.g. Bench Press: Peso máximo, Mejor 1RM, Mejor serie (volumen), Volumen de sesión, Reps totales. One point per workout.

### Step 4 - Change Range

The user taps *1 a*. The island calls `GET /api/progress/exercises/[id]/charts?range=1y` and redraws. Ranges: 30 d / 3 m / 1 a / todo.

### Step 5 - Récords Tab

SSR calls `getPersonalRecordsUseCase.execute({ userId, exerciseId })` → `RecordsTable` (each applicable record with value, date and a link to the workout; 1RM shown rounded to 0.5) and, for `weight_reps`, `RepMaxTable` (1–12 reps → best weight + date).

### Step 6 - Overview on /progress

`/progress` renders: *Resumen* (`getWeeklyOverviewUseCase`: 12 weekly bars for workouts, duration, volume, sets; tapping a bar lists that week's workouts), *Distribución muscular* (`getMuscleDistributionUseCase`, 7 d / 30 d / 3 m, Δ vs previous period, ⚠ above 20 sets/week), *Calendario* (`getMonthCalendarUseCase`, `?month=YYYY-MM`, deload days in a distinct color, tap a day for its workouts) and *Rachas* (day streak + `calculateWeeklyStreakUseCase`: "4 semanas seguidas").

---

## Edge Case: No Sessions Yet

Every tab shows an empty state: "Aún no has registrado este ejercicio". Records and charts are empty; no error.

## Edge Case: Bodyweight Exercise Without Body Weight

Weekly volume counts bodyweight sets as 0 and *Resumen* shows "Registra tu peso para incluir ejercicios con peso corporal" (FR-BM-007). Per-exercise charts of pull-ups use reps, so they are unaffected.

## Edge Case: lbs User

All weights convert at the page/endpoint boundary (kg → lb, 1 decimal). Comparisons and records use stored kg.

## Edge Case: Edited or Deleted Workout

Charts, records and history re-derive on the next read (ADR-020 §4); nothing to invalidate.

## Edge Case: Current Week Not Yet Complete

Weekly streak counts the current week only once it reaches `days_per_week` (default 3); otherwise it starts from the previous week.

## Failure: Unknown Exercise

`/exercises/[id]` with an unknown id → 404 page (exercise-library). The charts endpoint returns 404 for an unknown id.

## Failure: Slow Queries

NFR-PR-P2-01: p95 < 300 ms at 5,000 sets, checked by `tests/progress/perf-5000-sets.test.ts`. Above that, a cache is added (ADR-020 trade-off), not in Phase 2.
