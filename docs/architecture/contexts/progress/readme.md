# Progress & Charts Context

Parent: [../readme.md](../readme.md) · PRD: [progress.md](../../../prd/features/progress.md) · Phase 2: [ADR-020](../../decisions/020-personal-records.md), [ADR-026](../../decisions/026-weekly-ai-coach-summary.md), [schema 009](../../database-schema.md#009--ai-weekly-summaries-adr-026), stories [10.1](../../../stories/phase-2/round-10/story-10.1.md), [11.2](../../../stories/phase-2/round-11/story-11.2.md), [11.4](../../../stories/phase-2/round-11/story-11.4.md), [12.4](../../../stories/phase-2/round-12/story-12.4.md)

| Field | Value |
|-------|-------|
| Status | Phase 1 implemented · Phase 2 planned |
| Last edited | 2026-10-01 |
| Phase | 1, 2 |

> **Phase 2 changes (read first).** The Phase 1 sections below describe the shipped code and stay valid, with these supersessions:
>
> | Phase 1 | Phase 2 |
> |---|---|
> | FR-PR-001 history list (`GetWorkoutHistoryUseCase` in workout-tracking) | Extended by FR-PR-018 → [`GetHistoryUseCase`](#use-cases-phase-2) |
> | FR-PR-006 28-day `CalendarGrid` (`GetCalendarDataUseCase`) | Extended by FR-PR-016 → [`GetMonthCalendarUseCase`](#use-cases-phase-2). `GetCalendarDataUseCase` stays (regression), `/progress` renders the month view |
> | FR-PR-007 day streak | Kept; shown next to the weekly streak (FR-PR-017) |
> | FR-PR-002/003 exercise selector (`7d / 30d / all`) | Kept on `/progress`; links to `/exercises/[id]` *Gráficas* (FR-PR-012, ranges `30d / 3m / 1y / all`) |
> | Volume = Σ(reps × weight) of completed entries | Same for `weight_reps`; warm-ups excluded and bodyweight types use body weight (FR-BM-007) — Phase 1 data is all `normal` sets, so Phase 1 numbers do not change |
>
> Known drifts (code wins, [phase rules](../../../stories/phase-2/readme.md#2-code-is-the-source-of-truth-for-conventions)): the Svelte islands listed below are Astro components (`calendar-grid.astro`, `streak-counter.astro`); ports live in `domain/ports/*.ts`; the composition imports `@/lib/db/client` and `@/lib/supabase/client`; tests are in `tests/progress/`.

## Purpose

Progress visualization: workout history, exercise-specific charts, streaks, calendar.

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/progress/domain/`.

### `progress.types.ts`

```ts
// src/lib/contexts/progress/domain/progress.types.ts

import type { DateRange } from './progress.constants';

export interface ChartDataPoint {
  date: string;
  weight: number; // kg
  volume: number; // kg
}

export interface Streak {
  current: number; // consecutive days
  total: number; // all-time workouts
}

export interface CalendarDay {
  date: string;
  hasWorkout: boolean;
}

export interface GetExerciseHistoryInput {
  userId: string;
  exerciseId: string;
  range: DateRange;
}
```

### `progress.constants.ts`

```ts
// src/lib/contexts/progress/domain/progress.constants.ts

export const DateRanges = {
  Last7Days: '7d',
  Last30Days: '30d',
  All: 'all',
} as const;
export type DateRange = (typeof DateRanges)[keyof typeof DateRanges];

export const CalendarRules = {
  DisplayDays: 28, // 4 weeks
  MaxStreakGapDays: 1,
} as const;
```

### Entities

- `ProgressDataPoint` — derived entity. Has `date`, `weight` (max for day), `volume` (sum for day).
- `Streak` — derived value. Has `current` (consecutive days), `total` (all-time workouts).
- `CalendarDay` — derived value. Has `date`, `hasWorkout` (boolean).

### Value Objects

- `DateRange` — enum: `'7d'`, `'30d'`, `'all'`. Per `DateRanges`.
- `Volume` — calculated: sum of (sets × reps × weight) per exercise per workout.

### Invariants

- Progress is DERIVED from workout history. No separate progress entity stored.
- Volume = sum of (reps × weight) for all entries of an exercise in a workout.
- Streak = consecutive days with completed workouts ending today (or yesterday if no workout today).
- A "workout day" = day with at least one workout where status = 'completed'.
- Calendar shows last `CalendarRules.DisplayDays` (28) days (4 weeks). Each day is binary: has workout or not.
- Exercise selector shows ONLY exercises the user has actually logged.
- Weight displayed in user's preferred unit. Volume in same unit. Per [`ADR-006`](../../decisions/006-kg-storage.md).
- Charts aggregate by date: max weight per day, total volume per day.

### Ports

- `ProgressRepository` — getExerciseHistory(userId, exerciseId, dateRange), getCalendarData(userId), getStreak(userId).
- `ExerciseQueryRepository` — getLoggedExercises(userId).

---

## Application

### Use Cases

| Use case | Purpose | Status |
|----------|---------|--------|
| GetExerciseListUseCase | Fetch unique exercises user has logged | planned |
| GetExerciseHistoryUseCase | Fetch weight/volume data points for an exercise over time | planned |
| CalculateStreakUseCase | Count consecutive workout days ending today | planned |
| GetCalendarDataUseCase | Fetch workout dates for last 28 days | planned |

### Orchestration

1. `GetExerciseListUseCase` calls `ExerciseQueryRepository.getLoggedExercises(userId)` → returns exercise list.
2. `GetExerciseHistoryUseCase` calls `ProgressRepository.getExerciseHistory(userId, exerciseId, dateRange)` → aggregates by date → returns data points.
3. `CalculateStreakUseCase` calls `ProgressRepository.getStreak(userId)` → counts consecutive days → returns Streak.
4. `GetCalendarDataUseCase` calls `ProgressRepository.getCalendarData(userId)` → returns 28 CalendarDays.

---

## Infrastructure

Per [ADR-007](../../decisions/007-repository-pattern.md).

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/progress/domain/ports/ProgressRepository.ts
abstract class ProgressRepository {
  abstract getExerciseHistory(userId: string, exerciseId: string, range: DateRange): Promise<ChartDataPoint[]>;
  abstract getCalendarData(userId: string, days: number): Promise<CalendarDay[]>;
  abstract getStreak(userId: string): Promise<Streak>;
}

// src/lib/contexts/progress/domain/ports/ExerciseQueryRepository.ts
abstract class ExerciseQueryRepository {
  abstract getLoggedExercises(userId: string): Promise<Exercise[]>;
}
```

### Supabase Implementation (Production)

```ts
// src/lib/contexts/progress/infrastructure/supabase/supabase-progress.repository.ts
class SupabaseProgressRepository implements ProgressRepository {
  constructor(private supabase: SupabaseClient) {}

  async getExerciseHistory(userId: string, exerciseId: string, range: DateRange): Promise<ChartDataPoint[]> {
    const { data, error } = await this.supabase
      .from('workout_entries')
      .select('reps, weight, workouts!inner(workout_date, status, user_id)')
      .eq('workouts.user_id', userId)
      .eq('workouts.status', 'completed')
      .eq('exercise_id', exerciseId);
    if (error) throw new Error(error.message);
    return aggregateByDate(data); // domain logic
  }

  async getStreak(userId: string): Promise<Streak> {
    const { data } = await this.supabase
      .from('workouts')
      .select('workout_date')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('workout_date', { ascending: false });
    return calculateStreak(data); // domain logic
  }
}
```

### SQLite Implementation (Tests, E2E)

```ts
// src/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository.ts
class SqliteProgressRepository implements ProgressRepository {
  constructor(private db: Database) {}

  async getExerciseHistory(userId: string, exerciseId: string, range: DateRange): Promise<ChartDataPoint[]> {
    const rows = this.db.prepare(`
      SELECT we.reps, we.weight, w.workout_date
      FROM workout_entries we
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.user_id = ? AND w.status = 'completed' AND we.exercise_id = ?
    `).all(userId, exerciseId);
    return aggregateByDate(rows);
  }
  // ... other methods
}
```

### Wiring (Per-Context Composition)

Per [ADR-010](../../decisions/010-per-context-composition.md), no central root.

`src/lib/contexts/progress/progress.composition.ts`:

```ts
import { useSupabase, supabaseClient, sqliteDb } from '@/lib/config';
import { SupabaseProgressRepository } from './infrastructure/supabase/SupabaseProgressRepository';
import { SqliteProgressRepository } from './infrastructure/sqlite/SqliteProgressRepository';
import { SupabaseExerciseQueryRepository } from './infrastructure/supabase/SupabaseExerciseQueryRepository';
import { SqliteExerciseQueryRepository } from './infrastructure/sqlite/SqliteExerciseQueryRepository';
import { GetExerciseListUseCase } from './application/GetExerciseListUseCase';
import { GetExerciseHistoryUseCase } from './application/GetExerciseHistoryUseCase';
import { CalculateStreakUseCase } from './application/CalculateStreakUseCase';
import { GetCalendarDataUseCase } from './application/GetCalendarDataUseCase';

const progressRepo: ProgressRepository = useSupabase
  ? new SupabaseProgressRepository(supabaseClient)
  : new SqliteProgressRepository(sqliteDb);

const exerciseQueryRepo: ExerciseQueryRepository = useSupabase
  ? new SupabaseExerciseQueryRepository(supabaseClient)
  : new SqliteExerciseQueryRepository(sqliteDb);

export const getExerciseListUseCase = new GetExerciseListUseCase(exerciseQueryRepo);
export const getExerciseHistoryUseCase = new GetExerciseHistoryUseCase(progressRepo);
export const calculateStreakUseCase = new CalculateStreakUseCase(progressRepo);
export const getCalendarDataUseCase = new GetCalendarDataUseCase(progressRepo);
```

---

## UI

### Components

- `ProgressChart` — Chart.js line/bar charts.
- Exercise selector dropdown.
- Calendar grid component.
- Streak counter.

### Interactive components (Svelte)

- `ProgressChart.tsx` — React island, Chart.js rendering (per [ADR-002](../../decisions/002-chartjs-react-island.md)).
- `ExerciseSelector.svelte` — Svelte island, dropdown with state.
- `CalendarGrid.svelte` — Svelte island, calendar with dots.
- `StreakCounter.svelte` — Svelte island, animated counter.

### Pages

- `/progress` — SSR, charts + calendar + streaks.

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

`src/test/contexts/progress/CalculateStreakUseCase.test.ts`:

```ts
import { faker } from '@faker-js/faker';
import { createTestDb } from '@/test/setup';
import { SqliteProgressRepository } from '@/lib/contexts/progress/infrastructure/sqlite/SqliteProgressRepository';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/CalculateStreakUseCase';
import { WorkoutMother } from '@/test/mothers/WorkoutMother';

describe('CalculateStreakUseCase', () => {
  it('counts consecutive completed days', async () => {
    const db = createTestDb();
    const repo = new SqliteProgressRepository(db);
    // seed 5 consecutive completed workouts
    for (let i = 0; i < 5; i++) {
      await repo.create(WorkoutMother.completed({
        workout_date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
      }));
    }
    const useCase = new CalculateStreakUseCase(repo);

    const result = await useCase.execute(faker.string.uuid());

    expect(result.current).toBe(5);
  });
});
```


---

## Phase 2

Hevy's personal records, exercise statistics, weekly overview charts, muscle distribution, month calendar, weekly streak, history v2, CSV export, and the weekly AI coach summary. Requirements: [FR-PR-008 … FR-PR-021, NFR-PR-P2-01](../../../prd/features/progress.md#phase-2--functional-requirements).

Everything stays **derived** from workout data ([ADR-020 §4](../../decisions/020-personal-records.md)): no records table, no stats cache. The only new table is `ai_weekly_summaries` (owner-only cache, [schema 009](../../database-schema.md#009--ai-weekly-summaries-adr-026)).

| Owns | Reads (SQL over shared tables, or ports) | Provides |
|---|---|---|
| `ai_weekly_summaries`; pure records/stats modules | `workouts`, `workout_exercises`, `workout_entries`, `profiles` (unit, timezone, `days_per_week`) · `ExerciseCatalogPort` ([exercise-library](../exercise-library/readme.md)) · `BodyWeightPort` ([body-metrics](../body-metrics/readme.md)) · `ProgressionInsightsPort` ([progression](../progression/readme.md)) | `RecordBaselinePort` → workout-tracking (live PR badges) · `PrCountPort` → workout-tracking (summary), social (feed card, detail, share image), public-view (PRs in the last 30 days) |

### Domain (Phase 2)

New files in `src/lib/contexts/progress/domain/`:

| File | Content |
|---|---|
| `personal-records.ts` | Pure module of ADR-020: `e1rm`, `isEligibleSet`, `computeRecords`, `baselineFrom`, `detectPrs`, `applySetToBaseline`, `detectPrsInSequence`. Bundled in the live-workout island **and** used server-side (one implementation) |
| `stats.ts` | Pure: `setVolume`, `isoWeekStart`, `weeklyOverview`, `muscleDistribution`, `monthCalendar`, `weeklyStreak`, `exerciseChartSeries` |
| `weekly-facts.ts` | Pure: `buildWeeklyFacts`, `recommendationsFor`, `allowedNumbers`, `validateCoachOutput`, `renderTemplateSummary` |
| `workout-csv.ts` | Pure: `toWorkoutCsvRows`, `toCsv` |
| `stats.types.ts` | Types below |
| `progress.constants.ts` | + `RecordRules`, `RecordTypes`, `RecordApplicability`, `StatsRanges`, `StatsRules`, `ChartMetricsByType`, `CoachSummaryRules`, `WorkoutCsvColumns` |
| `ports/*.ts` | New ports (kebab-case files; the two Phase 1 ports keep their PascalCase files) |

> Decision: new progress ports go in the existing `domain/ports/` folder with kebab-case names (`stats-query.repository.ts`), next to the Phase 1 `ProgressRepository.ts`; the Phase 1 files are not renamed.

#### `personal-records.ts`

```ts
// src/lib/contexts/progress/domain/personal-records.ts
import type { WorkoutEntry, Exercise } from '@db/schema';

export type ExerciseType = NonNullable<Exercise['exerciseType']>;
export type SetType = WorkoutEntry['setType'];

export type RecordType =
  | 'heaviest_weight' | 'best_1rm' | 'best_set_volume' | 'best_session_volume'
  | 'most_reps' | 'least_assistance' | 'longest_duration' | 'longest_distance'
  | 'best_pace' | 'rep_max';
export type ScalarRecordType = Exclude<RecordType, 'rep_max'>;

export interface RecordSet {
  id: string;                    // workout_entries.id
  workoutId: string;
  workoutCompletedAt: Date;      // order across workouts (ADR-020 §3); in-progress workout → +∞
  position: number;              // workout_exercises.position
  setNumber: number;
  setType: SetType;
  completed: boolean;
  weight: number;                // kg (≤ 0 = assistance)
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
}

export interface RecordValue { value: number; workoutId: string; setId: string | null; achievedAt: Date }
export interface RepMaxRow { reps: number; weight: number; workoutId: string; achievedAt: Date }   // reps 1..12

export interface PersonalRecords {
  exerciseId: string;
  exerciseType: ExerciseType;
  records: Partial<Record<ScalarRecordType, RecordValue>>;
  repMax: RepMaxRow[];           // weight_reps only; rows without data omitted
}

/** Live-workout baseline (ADR-020 §4): best per record type excluding the current workout. */
export interface RecordBaseline {
  exerciseId: string;
  exerciseType: ExerciseType;
  hasHistory: boolean;           // false → first ever exposure → no badges
  best: Partial<Record<ScalarRecordType, number>>;
}

export interface SetPr { setId: string; types: ScalarRecordType[] }
```

Constants (in `progress.constants.ts`):

```ts
export const RecordRules = {
  E1rmMaxReps: 12,
  RepMaxTableMax: 12,
  PaceMinDistanceM: 400,
  DisplayRoundingKg: 0.5,        // display only; comparisons use full precision
} as const;

/** ADR-020 §1 — which record types apply to which exercise_type. */
export const RecordApplicability = {
  heaviest_weight: ['weight_reps', 'weighted_bodyweight', 'weight_distance'],
  best_1rm: ['weight_reps', 'weighted_bodyweight'],
  best_set_volume: ['weight_reps', 'weighted_bodyweight'],
  best_session_volume: ['weight_reps', 'weighted_bodyweight'],
  most_reps: ['bodyweight_reps', 'assisted_bodyweight', 'weighted_bodyweight'],
  least_assistance: ['assisted_bodyweight'],
  longest_duration: ['duration', 'distance_duration'],
  longest_distance: ['distance_duration', 'weight_distance'],
  best_pace: ['distance_duration'],
  rep_max: ['weight_reps'],
} as const;
export const LowerIsBetter = ['least_assistance', 'best_pace'] as const;

/** UI labels (es) — PR badge "🏆 Mejor 1RM" (FR-PR-009). */
export const RecordLabels = {
  heaviest_weight: 'Peso máximo', best_1rm: 'Mejor 1RM', best_set_volume: 'Mejor serie',
  best_session_volume: 'Mejor sesión', most_reps: 'Más reps', least_assistance: 'Menor asistencia',
  longest_duration: 'Mayor duración', longest_distance: 'Mayor distancia', best_pace: 'Mejor ritmo',
  rep_max: 'Récord por reps',
} as const;
```

Functions:

```ts
e1rm(weight: number, reps: number | null): number | null
  // Epley; null when reps is null, < 1 or > RecordRules.E1rmMaxReps; reps = 1 → weight
  return reps === 1 ? weight : weight × (1 + reps / 30)

isEligibleSet(s: RecordSet): boolean          // completed && setType !== 'warmup'   (ADR-020 §1)

setValue(s, type, exerciseType): number | null    // per-set value of a scalar type (not best_session_volume)
  heaviest_weight → s.weight ; best_1rm → e1rm(s.weight, s.reps) ; best_set_volume → s.weight × reps
  most_reps → reps ; least_assistance → reps ≥ 1 ? |s.weight| : null ; longest_duration → durationSeconds
  longest_distance → distanceM ; best_pace → distanceM ≥ 400 ? durationSeconds / distanceM : null

beats(type, candidate, best | undefined): boolean
  best === undefined → true                     // no previous value of this type
  LowerIsBetter.includes(type) ? candidate < best : candidate > best     // ties are never PRs

computeRecords(exerciseId, sets: RecordSet[], exerciseType): PersonalRecords
  eligible sets only, ordered by (workoutCompletedAt, position, setNumber)
  for each applicable scalar type: keep the FIRST set that reaches the best value (ties keep the earlier holder)
  best_session_volume: Σ(weight × reps) per workout, best workout, setId = null
  rep_max (weight_reps): for N in 1..12 → max weight over sets with reps ≥ N (+ its workout/date)

baselineFrom(records: PersonalRecords, hasHistory: boolean): RecordBaseline

detectPrs(baseline, s: RecordSet, sessionVolumeBefore: number): ScalarRecordType[]
  if !baseline.hasHistory or !isEligibleSet(s) → []
  prs = applicable scalar types (except session) where beats(type, setValue(s, type), baseline.best[type])
  sessionAfter = sessionVolumeBefore + s.weight × (s.reps ?? 0)
  if applies('best_session_volume') and beats('best_session_volume', sessionAfter, best) and !beats(..., sessionVolumeBefore, best)
     → prs.push('best_session_volume')          // badge on the set that crosses the record, once per workout
  return prs

applySetToBaseline(baseline, s): RecordBaseline   // raises `best` with this set's values (earlier sets of W compete)

detectPrsInSequence(baseline, sets: RecordSet[]): SetPr[]
  // sets of ONE exercise in ONE workout, ordered (position, setNumber); recomputed from the original baseline
  // on every check / uncheck / edit, so a badge disappears when a set drops below the record (FR-PR-009)
  b = baseline ; vol = 0 ; out = []
  for s in sets: types = detectPrs(b, s, vol); if types → out.push({ setId: s.id, types })
                 if isEligibleSet(s): b = applySetToBaseline(b, s); vol += s.weight × (s.reps ?? 0)
  return out
```

> Decision: `rep_max` produces no live badge (it is the records table only); Hevy badges weight, 1RM and volume, not each rep count.
>
> Decision: when the user has history but no previous value for a type (e.g. only 15-rep sets before, so no `best_1rm`), the first eligible value is a PR.

Worked examples (`tests/progress/personal-records.test.ts`):

| Case | Input | Expected |
|---|---|---|
| e1rm | (100, 5) · (100, 1) · (60, 12) · (80, 13) · (80, 0) | 116.67 · 100 · 84 · null · null |
| Sequence | Bench baseline `{ heaviest_weight: 100, best_1rm: 116.67, best_set_volume: 600, best_session_volume: 2400 }`, sets 100×5, 102.5×3, 90×8, 90×8, 80×10 | set 1 `[]` (ties) · set 2 `['heaviest_weight']` · set 3 `['best_set_volume']` (720) · set 4 `[]` (tie 720) · set 5 `['best_set_volume', 'best_session_volume']` (800; session 3047.5 > 2400) |
| Uncheck | Same, set 5 unchecked | set 5 `[]`; no session PR |
| Warm-up | `setType: 'warmup'`, 120×10 | `[]` |
| First exposure | `hasHistory: false`, any set | `[]` |
| Rep-max table | 100×5, 90×8, 80×10 | N 1–5 → 100 · N 6–8 → 90 · N 9–10 → 80 · N 11–12 omitted |
| Assisted | baseline `least_assistance: 30`, `most_reps: 8`; set −25 kg × 9 | `['most_reps', 'least_assistance']` |
| Pace | baseline `best_pace: 0.32` s/m; run 5,000 m in 1,500 s | `['best_pace', …]` (0.30 s/m = "5:00 /km") |
| Pace min distance | 300 m in 60 s | no `best_pace` value |

#### `stats.types.ts`

```ts
// src/lib/contexts/progress/domain/stats.types.ts
import type { MuscleGroup } from '@/lib/contexts/exercise-library/domain/exercise-library.constants';
import type { ScalarRecordType } from './personal-records';

export type StatsRange = '30d' | '3m' | '1y' | 'all';              // FR-PR-012: 30 d / 3 m / 1 a / todo
export type DistributionPeriod = '7d' | '30d' | '3m';              // FR-PR-015

export type ChartMetric =
  | 'max_weight' | 'best_1rm' | 'best_set_volume' | 'session_volume' | 'total_reps'
  | 'max_reps' | 'max_duration' | 'total_duration' | 'distance' | 'duration' | 'pace';

export interface ChartPoint { workoutId: string; date: string; value: number }   // one point per workout
export interface ExerciseCharts { exerciseId: string; range: StatsRange; series: Partial<Record<ChartMetric, ChartPoint[]>> }

export interface ExerciseSession {
  workoutId: string; workoutName: string; date: string;
  sets: { setId: string; label: string /* "W" | "D" | "F" | "1".. (ADR-016 §4) */; weight: number;
          reps: number | null; durationSeconds: number | null; distanceM: number | null; rpe: number | null;
          prs: ScalarRecordType[] }[];
}

export interface WeekBucket {
  weekStart: string;             // ISO Monday, 'YYYY-MM-DD', profiles.timezone
  workouts: number; durationSeconds: number; volumeKg: number; sets: number;
  workoutIds: string[];          // tap a bar → that week's workouts (FR-PR-014)
}
export interface WeeklyOverview { weeks: WeekBucket[]; missingBodyWeight: boolean }   // 12 buckets, oldest first

export interface MuscleShare {
  muscle: MuscleGroup; sets: number; previous: number; delta: number;
  perWeek: number; flagged: boolean;   // perWeek > 20 (ADR-022 §3)
}

export interface CalendarMonthDay { date: string; workoutIds: string[]; isDeload: boolean }
export interface CalendarMonth { month: string /* 'YYYY-MM' */; days: CalendarMonthDay[] }   // only days with workouts

export interface WeeklyStreak { weeks: number; target: number; currentWeekDone: number }

export interface HistoryItem {      // FR-PR-018
  workoutId: string; name: string; date: string; durationSeconds: number;
  volumeKg: number; sets: number; prCount: number; programId: string | null; routineDayId: string | null;
}

/** One PR of a workout (PrCountPort.listByWorkout). entryId is null for best_session_volume. */
export interface WorkoutSetPr {
  entryId: string | null; exerciseId: string; exerciseName: string; setNumber: number | null;
  recordType: ScalarRecordType; value: number;      // value in stored units (kg, reps, s, m, s/m)
}
```

Constants (in `progress.constants.ts`):

```ts
export const StatsRanges = { Days30: '30d', Months3: '3m', Year1: '1y', All: 'all' } as const;
export const DistributionPeriods = { Days7: '7d', Days30: '30d', Months3: '3m' } as const;

export const StatsRules = {
  OverviewWeeks: 12,              // FR-PR-014
  HistoryPageSize: 20,            // FR-PR-013, FR-PR-018
  DefaultDaysPerWeek: 3,          // FR-PR-017 when profiles.days_per_week is null
  WorkingSetTypes: ['normal', 'failure'],   // muscle distribution (same as progression)
  SecondaryMuscleWeight: 0.5,
  MaxSetsPerMusclePerWeek: 20,    // HealthRules (system.md)
} as const;

/** FR-PR-012 */
export const ChartMetricsByType = {
  weight_reps:         ['max_weight', 'best_1rm', 'best_set_volume', 'session_volume', 'total_reps'],
  weighted_bodyweight: ['max_weight', 'best_1rm', 'best_set_volume', 'session_volume', 'total_reps'],
  bodyweight_reps:     ['max_reps', 'total_reps'],
  assisted_bodyweight: ['max_reps', 'total_reps'],
  duration:            ['max_duration', 'total_duration'],
  distance_duration:   ['distance', 'duration', 'pace'],
  weight_distance:     ['max_weight', 'distance'],
} as const;

export const ChartMetricLabels = {
  max_weight: 'Peso máximo', best_1rm: 'Mejor 1RM', best_set_volume: 'Mejor serie (volumen)',
  session_volume: 'Volumen de sesión', total_reps: 'Reps totales', max_reps: 'Reps máximas',
  max_duration: 'Duración máxima', total_duration: 'Duración total', distance: 'Distancia',
  duration: 'Duración', pace: 'Ritmo',
} as const;
```

#### `stats.ts` — pure functions

```ts
setVolume(s, exerciseType, bodyWeightKg: number | null): number      // FR-BM-007; eligible sets only
  bw = bodyWeightKg ?? 0
  weight_reps → s.weight × reps
  weighted_bodyweight → (bw + s.weight) × reps
  bodyweight_reps → bw × reps
  assisted_bodyweight → max(0, bw − |s.weight|) × reps
  duration | distance_duration | weight_distance → 0

isoWeekStart(date: Date, timezone: string): string                 // local Monday 'YYYY-MM-DD'

weeklyOverview(workouts, sets, bodyWeights: BodyWeightPoint[], today, timezone): WeeklyOverview
  12 buckets ending with the current ISO week
  workouts/week = count; duration/week = Σ (completedAt − startedAt); sets/week = Σ eligible sets
  volume/week = Σ setVolume(s, type, bodyWeightOn(bodyWeights, workout date))
  missingBodyWeight = some eligible set of a bodyweight type exists and bodyWeights is empty
                      → hint "Registra tu peso para incluir ejercicios con peso corporal"

muscleDistribution(sets, period, today): MuscleShare[]
  current = sets in [today − period, today]; previous = the equal period before
  per muscle: Σ (primary 1.0, each secondary 0.5) over completed working sets (normal, failure)
  perWeek = sets / (periodDays / 7); flagged = perWeek > 20; sorted by sets DESC

monthCalendar(workouts, month: 'YYYY-MM', timezone): CalendarMonth
  group completed workouts by local date; isDeload = any workout of the day has is_deload

weeklyStreak(workouts, daysPerWeek | null, today, timezone): WeeklyStreak
  target = daysPerWeek ?? 3; count[week] = completed workouts per ISO week
  start  = count[currentWeek] ≥ target ? currentWeek : previousWeek
  weeks  = consecutive weeks from `start` backwards with count ≥ target

exerciseChartSeries(sessions, exerciseType, range, today): ExerciseCharts
  one point per workout (date = local date of completedAt), metrics from ChartMetricsByType:
  max_weight = max weight · best_1rm = max e1rm · best_set_volume = max weight × reps
  session_volume = Σ weight × reps · total_reps = Σ reps · max_reps = max reps
  max_duration = max duration · total_duration = Σ duration
  distance = Σ distanceM · duration = Σ duration · pace = Σ duration / Σ distanceM × 1000 (s/km)
```

> Decision: weekly volume (FR-PR-014) uses body weight per FR-BM-007, while per-exercise charts and records use the logged (added) weight, matching ADR-020's formulas. Distance-type sets add 0 volume (Hevy shows no volume for cardio).
>
> Decision: sets/week and volume count every completed non-warm-up set (same eligibility as records); muscle distribution counts working sets only (`normal`, `failure`), as FR-PR-015 says.

#### `weekly-facts.ts` — facts JSON (ADR-026 §1)

```ts
export type RecommendationCode =
  | 'hit_frequency' | 'plateau_options' | 'deload_recommended' | 'high_volume' | 'low_readiness' | 'keep_going';

export interface WeeklyFacts {
  version: 1;
  locale: 'es';
  weekStart: string;              // ISO Monday 'YYYY-MM-DD' (profiles.timezone)
  weekEnd: string;                // Sunday
  isCurrentWeek: boolean;
  weightUnit: 'kg' | 'lb';        // every mass below is in this unit, rounded to 1 decimal
  workouts: { done: number; planned: number | null };          // planned = profiles.days_per_week
  volume: { total: number; previous: number; deltaPct: number | null };   // deltaPct integer, null when previous = 0
  sets: { total: number; previous: number; deltaPct: number | null };
  durationMinutes: number;
  prs: { exercise: string; record: ScalarRecordType; label: string; value: number; unit: string }[];
  plateaus: { exercise: string }[];                              // ProgressionInsightsPort.listPlateaus
  deload: { status: 'active' | 'recommended' | 'none'; until: string | null };
  muscleSets: { muscle: string; label: string; sets: number }[]; // top 6, DESC
  highVolumeMuscles: string[];                                   // labels with > 20 sets
  readiness: { average: number | null; checkins: number };       // ProgressionInsightsPort.getReadinessAverage
  bodyWeight: { latest: number | null; delta: number | null } | null;   // owner's own summary only
  recommendations: { code: RecommendationCode; text: string }[]; // 1–3, deterministic
}
```

Example:

```json
{
  "version": 1, "locale": "es", "weekStart": "2026-09-21", "weekEnd": "2026-09-27", "isCurrentWeek": false,
  "weightUnit": "kg",
  "workouts": { "done": 3, "planned": 4 },
  "volume": { "total": 18250, "previous": 16900, "deltaPct": 8 },
  "sets": { "total": 62, "previous": 58, "deltaPct": 7 },
  "durationMinutes": 196,
  "prs": [{ "exercise": "Bench Press (Barbell)", "record": "heaviest_weight", "label": "Peso máximo", "value": 85, "unit": "kg" }],
  "plateaus": [{ "exercise": "Squat (Barbell)" }],
  "deload": { "status": "none", "until": null },
  "muscleSets": [{ "muscle": "chest", "label": "Pecho", "sets": 14 }, { "muscle": "quadriceps", "label": "Cuádriceps", "sets": 12 }],
  "highVolumeMuscles": [],
  "readiness": { "average": 3.8, "checkins": 3 },
  "bodyWeight": { "latest": 78.2, "delta": -0.4 },
  "recommendations": [
    { "code": "hit_frequency", "text": "Intenta llegar a 4 entrenamientos la próxima semana." },
    { "code": "plateau_options", "text": "Revisa Squat (Barbell): prueba «Bajar y reconstruir»." }
  ]
}
```

`recommendationsFor(facts)` — first 3 that apply, in this order (fallback `keep_going` when none):

| Code | When | Text (es) |
|---|---|---|
| `hit_frequency` | `planned` and `done < planned` | `Intenta llegar a {planned} entrenamientos la próxima semana.` |
| `deload_recommended` | `deload.status = 'recommended'` | `Considera empezar una semana de descarga.` |
| `plateau_options` | ≥ 1 plateau | `Revisa {exercise}: prueba «Bajar y reconstruir».` |
| `high_volume` | ≥ 1 high-volume muscle | `Reduce algunas series de {label}.` |
| `low_readiness` | `average < 2.5` | `Prioriza el descanso: tu check-in medio fue bajo.` |
| `keep_going` | none of the above | `Mantén el ritmo: repite el plan la próxima semana.` |

Coach output rules:

| Rule | Check (`validateCoachOutput`) |
|---|---|
| Output JSON `{ "summary": string, "tips": string[] }` (`responseMimeType: application/json`) | parse error → fallback |
| Spanish, ≤ 120 words in `summary` | word count > 120 → fallback |
| 1–3 tips, each a paraphrase of a `recommendations[].text` | count ∉ 1..3 → fallback |
| No number that is not in the facts | every number token (`\d+([.,]\d+)?`) must be in `allowedNumbers(facts)` (all numeric facts, also with `,` decimals) → else fallback |
| No medical, injury or nutrition advice; no diagnosis | enforced by the prompt (not machine-checked) |

Prompt (system, es), stored as `CoachSummaryRules.SystemPrompt`:

```text
Eres un entrenador personal que resume la semana de entrenamiento de un usuario.
Escribe en español, en segunda persona, tono cercano y positivo, máximo 120 palabras.
Usa SOLO los datos del JSON. No escribas ningún número que no aparezca en el JSON.
No des consejos médicos, de lesiones ni de nutrición, ni diagnósticos.
Los consejos ("tips") deben ser de 1 a 3 y salir de "recommendations", con tus palabras.
Responde solo con JSON: {"summary": "...", "tips": ["..."]}.
```

`renderTemplateSummary(facts)` (fallback, deterministic): "Esta semana hiciste {done} de {planned} entrenamientos. Volumen total: {total} {unit} ({deltaPct} % vs la semana anterior)." + "Lograste {n} récords: {exercise} ({label})." when PRs + "Estancado: {exercises}." when plateaus + "Descarga activa hasta {until}." when active + "Tu energía media fue {average}/5." when check-ins; tips = `recommendations[].text`.

```ts
export const CoachSummaryRules = {
  Model: AIAnalysisRules.DefaultModel,    // reuse nutrition's Gemini model constant (see note)
  TemplateModel: 'template',              // ai_weekly_summaries.model for the fallback
  TimeoutMs: 20_000,
  MaxWords: 120,
  MinTips: 1,
  MaxTips: 3,
  MaxRegenerationsPerWeek: 3,
  Temperature: 0.4,
} as const;
```

> Note: ADR-026 names `gemini-2.5-flash`; the code (`AIAnalysisRules.DefaultModel` in nutrition) moved to `gemini-3.5-flash` because 2.5 is deprecated for new keys. Code wins: the coach reuses the same model value, and `ai_weekly_summaries.model` stores whatever was used.

#### `workout-csv.ts` — export mapping (FR-PR-021)

One row per **completed** set of the user's **completed** workouts (`deleted_at IS NULL`), ordered by `workouts.started_at`, `workout_exercises.position`, `workout_entries.set_number`. File `gymup-workouts.csv`, UTF-8, RFC 4180 quoting, CRLF, header row.

```ts
export const WorkoutCsvColumns = [
  'title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id', 'exercise_notes',
  'set_index', 'set_type', 'weight_kg', 'reps', 'distance_km', 'duration_seconds', 'rpe',
] as const;
```

| Column | Source | Mapping |
|---|---|---|
| `title` | `workouts.name` | as is |
| `start_time` | `workouts.started_at` | ISO-8601 with offset in `profiles.timezone`, e.g. `2026-09-28T18:05:00+02:00` |
| `end_time` | `workouts.completed_at` | same format |
| `description` | `workouts.notes` | empty when null |
| `exercise_title` | `exercises.name` | English name |
| `superset_id` | `workout_exercises.superset_group` | integer as stored; empty when null |
| `exercise_notes` | `workout_exercises.notes` | empty when null |
| `set_index` | `workout_entries.set_number` | `set_number − 1` (0-based, Hevy) |
| `set_type` | `workout_entries.set_type` | `normal` → `normal`, `warmup` → `warmup`, `drop` → `dropset`, `failure` → `failure` (Hevy values) |
| `weight_kg` | `workout_entries.weight` | kg, always (even for lbs users); negative = assistance; empty for types without weight (`bodyweight_reps`, `distance_duration`) |
| `reps` | `workout_entries.reps` | empty when null |
| `distance_km` | `workout_entries.distance_m` | `distance_m / 1000`, up to 3 decimals; empty when null |
| `duration_seconds` | `workout_entries.duration_seconds` | empty when null |
| `rpe` | `workout_entries.rpe` | empty when null |

> Decision: `set_index` is 0-based and `drop` exports as `dropset` (Hevy's CSV format). Unchecked sets are not exported (they are discarded at finish, FR-WT-035).

### Ports (Phase 2)

| Port | File | Kind | Implemented by |
|---|---|---|---|
| `StatsQueryRepository` | `domain/ports/stats-query.repository.ts` | required | `SqliteStatsQueryRepository`, `SupabaseStatsQueryRepository` (read-only SQL over workout tables) |
| `StatsProfilePort` | `domain/ports/stats-profile.port.ts` | required | `SqliteStatsProfileAdapter`, `SupabaseStatsProfileAdapter` (`weight_unit`, `timezone`, `days_per_week`) |
| `WeeklySummaryRepository` | `domain/ports/weekly-summary.repository.ts` | required | `SqliteWeeklySummaryRepository`, `SupabaseWeeklySummaryRepository` (owner-only) |
| `CoachSummaryPort` | `domain/ports/coach-summary.port.ts` | required | `GeminiCoachSummaryAdapter`, `TemplateCoachSummaryAdapter` (`infrastructure/ai/`) |
| `BodyWeightPort` | body-metrics `domain/ports/body-weight.port.ts` | required (consumed) | body-metrics `BodyWeightService` (`getBodyWeightOn`, `listBodyWeights`) |
| `ExerciseCatalogPort` | exercise-library `domain/exercise-catalog.port.ts` | required (consumed) | `findByIds(ids)` → name, `exerciseType`, `muscleGroup`, `secondaryMuscles` (archived and family-owned included) |
| `ProgressionInsightsPort` | progression `domain/ports/progression-insights.port.ts` | required (consumed) | progression `ProgressionInsightsService` |
| `RecordBaselinePort` | `domain/ports/record-baseline.port.ts` | **provided** → workout-tracking | `RecordBaselineService` |
| `PrCountPort` | `domain/ports/pr-count.port.ts` | **provided** → workout-tracking (summary FR-WT-036), social (FR-SO-002/003, FR-SO-008) | `PrCountService` |

```ts
// src/lib/contexts/progress/domain/ports/stats-query.repository.ts
export interface StatWorkoutRow {
  id: string; userId: string; name: string; notes: string | null;
  startedAt: Date; completedAt: Date; isDeload: boolean; programId: string | null; routineDayId: string | null;
}
/** Set rows carry ids only; use cases enrich them with ExerciseCatalogPort.findByIds (name, type, muscles). */
export interface StatSetRow extends RecordSet {
  workoutExerciseId: string; exerciseId: string;
  supersetGroup: number | null; exerciseNotes: string | null; completedAt: Date | null; rpe: number | null;
}
export interface HistoryFilter { programId?: string; routineDayId?: string }

export abstract class StatsQueryRepository {
  /** Completed workouts of the user, completed_at in [from, to) (null = open), ASC. */
  abstract findCompletedWorkouts(userId: string, from: Date | null, to: Date | null): Promise<StatWorkoutRow[]>;
  /** Every live set of these workouts (completed or not), ordered (workout, position, set_number). Read-all. */
  abstract findSetsForWorkouts(workoutIds: string[]): Promise<StatSetRow[]>;
  /** Sets of one exercise in the user's completed workouts; optional bounds for baselines and PR replay. */
  abstract findExerciseSets(userId: string, exerciseId: string,
    opts?: { completedBefore?: Date; excludeWorkoutId?: string; since?: Date }): Promise<StatSetRow[]>;
  abstract findExerciseSessionPage(userId: string, exerciseId: string, limit: number, offset: number): Promise<StatWorkoutRow[]>;
  abstract countExerciseSessions(userId: string, exerciseId: string): Promise<number>;
  abstract findHistoryPage(userId: string, filter: HistoryFilter, limit: number, offset: number): Promise<StatWorkoutRow[]>;   // completed_at DESC
  abstract countHistory(userId: string, filter: HistoryFilter): Promise<number>;
  /** Read-all lookup used by PrCountPort for siblings' workouts. */
  abstract findWorkoutsByIds(workoutIds: string[]): Promise<StatWorkoutRow[]>;
}

// domain/ports/stats-profile.port.ts
export abstract class StatsProfilePort {
  abstract findProfile(userId: string): Promise<{ weightUnit: 'kg' | 'lbs'; timezone: string; daysPerWeek: number | null } | undefined>;
}

// domain/ports/weekly-summary.repository.ts
export abstract class WeeklySummaryRepository {
  abstract findByWeek(userId: string, weekStart: Date): Promise<AiWeeklySummary | undefined>;   // owner-guarded
  abstract upsert(input: NewAiWeeklySummary): Promise<AiWeeklySummary>;                        // PK (user_id, week_start)
}

// domain/ports/coach-summary.port.ts
export interface CoachSummaryText { summary: string; tips: string[]; model: string }
export abstract class CoachSummaryPort {
  /** Throws on missing key, timeout (20 s), HTTP error or output that fails validateCoachOutput. */
  abstract generate(facts: WeeklyFacts, locale?: 'es'): Promise<CoachSummaryText>;
}

// domain/ports/record-baseline.port.ts — PROVIDED to workout-tracking
export abstract class RecordBaselinePort {
  /** One baseline per exercise id: best values over the user's completed workouts, excluding `excludeWorkoutId`
   *  and (edit mode) limited to workouts completed before `completedBefore`. Every requested id is present
   *  (`hasHistory: false`, `best: {}` when the user never did it). */
  abstract getBaselines(userId: string, exerciseIds: string[],
    opts?: { excludeWorkoutId?: string; completedBefore?: Date }): Promise<Record<string, RecordBaseline>>;
}

// domain/ports/pr-count.port.ts — PROVIDED to workout-tracking, social and public-view
export abstract class PrCountPort {
  /** PR count per completed workout (recomputed, ADR-020 §4). Any user's workout (read-all data). Missing id → 0. */
  abstract countByWorkouts(workoutIds: string[]): Promise<Map<string, number>>;
  /** PRs of one workout, ordered by exercise position then set number. */
  abstract listByWorkout(workoutId: string): Promise<WorkoutSetPr[]>;
  /** Total PRs of the user's workouts completed at or after `since` (member card "PRs en 30 días"). */
  abstract countByUserSince(userId: string, since: Date): Promise<number>;
}
```

Drizzle (story 11.4):

```ts
export const aiWeeklySummaries = sqliteTable('ai_weekly_summaries', {
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  weekStart: integer('week_start', { mode: 'timestamp_ms' }).notNull(),   // DATE, ISO Monday in profiles.timezone
  factsJson: text('facts_json').notNull(),
  summaryText: text('summary_text').notNull(),
  model: text('model').notNull(),                                         // Gemini model id | 'template'
  regenerations: integer('regenerations').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [primaryKey({ columns: [t.userId, t.weekStart] })]);
export type AiWeeklySummary = typeof aiWeeklySummaries.$inferSelect;
export type NewAiWeeklySummary = typeof aiWeeklySummaries.$inferInsert;
```

`summary_text` stores the summary followed by the tips as lines starting with `- `.

### Use Cases (Phase 2)

| Use case | Purpose | Story | Status |
|---|---|---|---|
| `GetPersonalRecordsUseCase` | Récords tab: every applicable record + rep-max table for one exercise (FR-PR-011) | [10.1](../../../stories/phase-2/round-10/story-10.1.md) | planned |
| `GetWorkoutPrsUseCase` | PRs of one workout, recomputed (summary, detail, share image, FR-PR-010) | 10.1 | planned |
| `RecordBaselineService` (`RecordBaselinePort`) | Baselines for the live island (FR-PR-009) | 10.1 | planned |
| `PrCountService` (`PrCountPort`) | `countByWorkouts`, `listByWorkout`, `countByUserSince` for summary, feed, detail, share image, member card, history | 10.1 | planned |
| `GetExerciseChartsUseCase` | Gráficas tab: metric series per type and range (FR-PR-012) | [11.2](../../../stories/phase-2/round-11/story-11.2.md) | planned |
| `GetExerciseSessionHistoryUseCase` | Historial tab (exercise history v2): sessions newest first, sets with labels and PR badges, 20 per page (FR-PR-013) | 11.2 | planned |
| `GetWeeklyOverviewUseCase` | 12 ISO weeks: workouts, duration, volume (bodyweight via `BodyWeightPort`), sets (FR-PR-014) | 11.2 | planned |
| `GetMuscleDistributionUseCase` | Sets per muscle for 7 d / 30 d / 3 m with Δ and flags (FR-PR-015) | 11.2 | planned |
| `GetMonthCalendarUseCase` | Month view with workout and deload days (FR-PR-016) | 11.2 | planned |
| `CalculateWeeklyStreakUseCase` | Consecutive ISO weeks meeting `days_per_week` (FR-PR-017) | 11.2 | planned |
| `GetHistoryUseCase` | History v2 list: name, date, duration, volume, sets, PR count, program/routine filter (FR-PR-018) | [9.3](../../../stories/phase-2/round-9/story-9.3.md) (PR count from 10.1) | planned |
| `BuildWeeklyFactsUseCase` | Deterministic `WeeklyFacts` for an ISO week (ADR-026 §1) | [11.4](../../../stories/phase-2/round-11/story-11.4.md) | planned |
| `GetWeeklyCoachSummaryUseCase` | Cached summary of the last closed week (generated lazily) or of the current week (FR-PR-019) | 11.4 | planned |
| `RegenerateWeeklySummaryUseCase` | *Generar resumen* for the current week, max 3 per week (FR-PR-020) | 11.4 | planned |
| `ExportWorkoutsCsvUseCase` | `gymup-workouts.csv` (FR-PR-021) | [12.4](../../../stories/phase-2/round-12/story-12.4.md) | planned |

### Orchestration (Phase 2)

1. **`GetPersonalRecordsUseCase.execute({ userId, exerciseId })`** → `stats.findExerciseSets(userId, exerciseId)` → `computeRecords` → values converted to display units by the page.
2. **`GetWorkoutPrsUseCase.execute({ workoutId })`** → `stats.findWorkoutsByIds([id])` (owner = workout's user) → sets of the workout → `exerciseCatalogPort.findByIds` (type, name) → for each exercise: `stats.findExerciseSets(ownerId, exerciseId, { completedBefore: workout.completedAt, excludeWorkoutId })` → `baselineFrom(computeRecords(...), hasHistory)` → `detectPrsInSequence` → `WorkoutSetPr[]`.
3. **`RecordBaselineService.getBaselines(userId, exerciseIds, opts)`** → per exercise `findExerciseSets` with the bounds → `baselineFrom(computeRecords(...), sets.length > 0)` → `Record<exerciseId, RecordBaseline>`. The live island calls `detectPrsInSequence` on every set change (works offline, ADR-025).
4. **`PrCountService`** — `listByWorkout(id)` = step 2; `countByWorkouts(ids)` = step 2 per workout, batched by owner (one `findExerciseSets` per owner × exercise) → `Map<workoutId, count>`; `countByUserSince(userId, since)` = `findCompletedWorkouts(userId, since, null)` → `countByWorkouts` → sum.
5. **`GetExerciseChartsUseCase.execute({ userId, exerciseId, range }, now)`** → `findExerciseSets(userId, exerciseId, { since: cutoff(range) })` → `exerciseChartSeries`.
6. **`GetExerciseSessionHistoryUseCase.execute({ userId, exerciseId, page })`** → `findExerciseSessionPage` + `countExerciseSessions` → sets per workout → PR badges via step 2 → `ExerciseSession[]`.
7. **`GetWeeklyOverviewUseCase.execute({ userId }, now)`** → profile (timezone) → `findCompletedWorkouts(userId, start of week −11, null)` → `findSetsForWorkouts` → `bodyWeightPort.listBodyWeights(userId, now)` → `weeklyOverview`.
8. **`GetMuscleDistributionUseCase.execute({ userId, period }, now)`** → workouts of 2 × period → sets → `muscleDistribution`.
9. **`GetMonthCalendarUseCase.execute({ userId, month }, now)`** → workouts of the month (local) → `monthCalendar`. `month` defaults to the current local month; ‹ › navigate with `?month=YYYY-MM`.
10. **`CalculateWeeklyStreakUseCase.execute({ userId }, now)`** → profile (`daysPerWeek`) → all completed workouts (dates only) → `weeklyStreak`.
11. **`GetHistoryUseCase.execute({ userId, filter, page })`** → `findHistoryPage` + `countHistory` → sets → duration, volume (bodyweight via `BodyWeightPort`), sets → `prCountPort.countByWorkouts(ids)` → `HistoryItem[]`.
12. **`BuildWeeklyFactsUseCase.execute({ userId, weekStart }, now)`**
    1. Profile (unit, timezone, `daysPerWeek`); week bounds `[weekStart, weekStart + 7 d)` and the previous week.
    2. Workouts + sets of both weeks → done, volume, sets, duration (as in step 7).
    3. PRs: `GetWorkoutPrsUseCase` for each workout of the week.
    4. `progressionInsightsPort.listPlateaus(userId)`, `.getDeloadStatus(userId)`, `.getReadinessAverage(userId, weekStart, weekEnd)`.
    5. `muscleDistribution` for the week (top 6, high-volume labels).
    6. Body weight: `bodyWeightPort.getBodyWeightOn(userId, weekEnd)` − `getBodyWeightOn(userId, weekStart − 1 d)`.
    7. Round masses to 1 decimal in the display unit, `recommendationsFor` → `WeeklyFacts`.
13. **`GetWeeklyCoachSummaryUseCase.execute({ userId, week: 'last' | 'current' }, now)`**
    1. `weekStart` = previous ISO Monday (`last`) or current (`current`).
    2. `cached = summaries.findByWeek(userId, weekStart)` → return it with `remainingRegenerations = 3 − regenerations` (current week only).
    3. `current` without cache → `null` (the card shows *Generar resumen*).
    4. `last` without cache → `facts = BuildWeeklyFacts` → `generateWithFallback(facts)` → `upsert({ …, regenerations: 0 })`.
    5. `generateWithFallback`: no `GEMINI_API_KEY` → template; else `gemini.generate(facts)` with 20 s timeout; any error or failed validation → `TemplateCoachSummaryAdapter.generate(facts)`. Never throws.
14. **`RegenerateWeeklySummaryUseCase.execute({ userId }, now)`** → current week; `existing.regenerations ≥ 3` → `WeeklySummaryLimitError` (429, button shows "Disponible el lunes"); else build facts → `generateWithFallback` → upsert with `regenerations = (existing?.regenerations ?? 0) + 1`.
15. **`ExportWorkoutsCsvUseCase.execute({ userId })`** → profile (timezone) → `findCompletedWorkouts(userId, null, null)` → `findSetsForWorkouts` (completed only) → `toWorkoutCsvRows` → `toCsv`.

> Decision: every *Generar resumen* tap for the current week counts (the first creates the row with `regenerations = 1`); closed weeks are generated once, lazily, and are not regenerated. Simplest reading of ADR-026 §3 + FR-PR-020.
>
> Decision: the weekly coach card is a React island that calls the API after the page renders, so a slow Gemini call (≤ 20 s) never blocks `/progress` SSR.

### Infrastructure (Phase 2)

- **SQLite** (`infrastructure/sqlite/`): `sqlite-stats-query.repository.ts`, `sqlite-stats-profile.adapter.ts`, `sqlite-weekly-summary.repository.ts`. Per golden rules, they query the shared tables directly and import no workout-tracking repository. `SqliteWeeklySummaryRepository` guards every query with `where user_id = ?`.
- **Supabase** (`infrastructure/supabase/`): same three files. `ai_weekly_summaries_own` RLS (`FOR ALL`, `auth.uid() = user_id`). Stats queries rely on read-all `workouts` / `workout_entries` / `workout_exercises` and still filter `user_id` explicitly.
- **AI** (`infrastructure/ai/`): `gemini-coach-summary.adapter.ts` (`GeminiCoachSummaryAdapter`, same REST call shape as `GeminiVisionAdapter`, text-only, `AbortController` at 20 s, `validateCoachOutput` before returning) and `template-coach-summary.adapter.ts` (`TemplateCoachSummaryAdapter`, wraps `renderTemplateSummary`, `model: 'template'`).
- All set reads filter `deleted_at IS NULL` once story 12.3 lands (ADR-025).

**NFR-PR-P2-01 (p95 < 300 ms at 5,000 sets).** Query shapes and the indexes they rely on:

| Query | Index |
|---|---|
| Sets of one exercise for one user (`findExerciseSets`) | `idx_entries_exercise (exercise_id)` + `idx_workouts_completed (user_id, completed_at DESC) WHERE status='completed'` |
| History / session pages | `idx_workouts_completed` |
| Sets of a list of workouts | `idx_entries_workout (workout_id)`, `idx_workout_exercises_workout (workout_id, position)` |
| Live rows (after 12.3) | `idx_entries_live`, `idx_workout_exercises_live` |

`db/schema.ts` declares no indexes today; story 10.1 checks that the SQLite migrations contain `idx_entries_exercise` and `idx_workouts_completed` and adds `index()` declarations if they are missing. `tests/progress/perf-5000-sets.test.ts` seeds 5,000 sets over 250 workouts for one user and asserts that `GetPersonalRecordsUseCase`, `GetExerciseChartsUseCase` and `GetExerciseSessionHistoryUseCase` each stay under 300 ms p95 over 20 runs on SQLite. Above that, add a cache (ADR-020 trade-off) — out of scope for Phase 2.

**Wiring** (`progress.composition.ts`, appended to the Phase 1 exports):

```ts
import { bodyWeightPort } from '@/lib/contexts/body-metrics/body-metrics.composition';
import { progressionInsightsPort } from '@/lib/contexts/progression/progression.composition';
import { exerciseCatalogPort } from '@/lib/contexts/exercise-library/exercise-library.composition';
// Every stats use case below also receives exerciseCatalogPort (omitted for brevity).

const stats = buildStatsQueryRepository(backend);
const statsProfile = buildStatsProfile(backend);
const summaries = buildWeeklySummaryRepository(backend);
const gemini = process.env.GEMINI_API_KEY ? new GeminiCoachSummaryAdapter(process.env.GEMINI_API_KEY) : null;
const template = new TemplateCoachSummaryAdapter();

export const getWorkoutPrsUseCase = new GetWorkoutPrsUseCase(stats);
export const getPersonalRecordsUseCase = new GetPersonalRecordsUseCase(stats);
export const recordBaselinePort: RecordBaselinePort = new RecordBaselineService(stats);
export const prCountPort: PrCountPort = new PrCountService(stats);
export const getExerciseChartsUseCase = new GetExerciseChartsUseCase(stats);
export const getExerciseSessionHistoryUseCase = new GetExerciseSessionHistoryUseCase(stats, getWorkoutPrsUseCase);
export const getWeeklyOverviewUseCase = new GetWeeklyOverviewUseCase(stats, statsProfile, bodyWeightPort);
export const getMuscleDistributionUseCase = new GetMuscleDistributionUseCase(stats, statsProfile);
export const getMonthCalendarUseCase = new GetMonthCalendarUseCase(stats, statsProfile);
export const calculateWeeklyStreakUseCase = new CalculateWeeklyStreakUseCase(stats, statsProfile);
export const getHistoryUseCase = new GetHistoryUseCase(stats, statsProfile, bodyWeightPort, prCountPort);
export const buildWeeklyFactsUseCase = new BuildWeeklyFactsUseCase(stats, statsProfile, bodyWeightPort, progressionInsightsPort, getWorkoutPrsUseCase);
export const getWeeklyCoachSummaryUseCase = new GetWeeklyCoachSummaryUseCase(summaries, buildWeeklyFactsUseCase, gemini, template);
export const regenerateWeeklySummaryUseCase = new RegenerateWeeklySummaryUseCase(summaries, buildWeeklyFactsUseCase, gemini, template);
export const exportWorkoutsCsvUseCase = new ExportWorkoutsCsvUseCase(stats, statsProfile);
```

### UI (Phase 2)

Specs: [components.md → Progress v2](../../components.md#progress-v2).

| Component | File | Kind | Content |
|---|---|---|---|
| `PrBadge` | `pr-badge.tsx` | React (live island, summary, detail) | 🏆 + `RecordLabels[type]`; toast + haptic once per set (FR-PR-009) |
| `RecordsTable` | `records-table.astro` | Astro | Each applicable record: value (display unit; 1RM rounded to 0.5), date, link to `/workouts/[id]` |
| `RepMaxTable` | `rep-max-table.astro` | Astro | 1–12 reps → best weight + date (`weight_reps` only) |
| `ExerciseChartsPanel` | `exercise-charts-panel.tsx` | React island (Chart.js) | Metric tabs from `ChartMetricsByType`, ranges 30 d / 3 m / 1 a / todo |
| `ExerciseSessionList` | `exercise-session-list.astro` | Astro | Sessions with set labels (W/D/F/n) and PR badges, pagination |
| `WeeklyBarsChart` | `weekly-bars-chart.tsx` | React island | 4 bar charts (Entrenamientos, Duración, Volumen, Series), 12 weeks; tap a bar → list of that week's workouts; body-weight hint |
| `MuscleDistributionChart` | `muscle-distribution-chart.tsx` | React island | Horizontal bars DESC, Δ vs previous period, ⚠ flag > 20 sets/week |
| `MonthCalendar` | `month-calendar.astro` | Astro | Month grid, ‹ › links (`?month=`), workout dots, deload days in a distinct color, tap a day → its workouts |
| `WeeklyStreakCounter` | `weekly-streak-counter.astro` | Astro | "{n} semanas seguidas" next to the Phase 1 `StreakCounter` |
| `CoachSummaryCard` | `coach-summary-card.tsx` | React island | "Resumen semanal" (last closed week), *Ver semana actual*, *Generar resumen* ("Disponible el lunes" when exhausted); template text looks identical, no error state |
| `HistoryList` | `history-list.astro` | Astro | FR-PR-018 items + program/routine filter |

Pages:

| Page | Sections |
|---|---|
| `/progress` | 1. *Resumen semanal* (`CoachSummaryCard`) · 2. *Resumen* (`WeeklyBarsChart`, `getWeeklyOverviewUseCase`) · 3. *Distribución muscular* (`?period=`) · 4. *Calendario* (`MonthCalendar`, `?month=`) · 5. *Rachas* (day streak + weekly streak) · 6. Phase 1 exercise selector + chart, with "Ver detalle" → `/exercises/[id]?tab=graficas` |
| `/exercises/[id]` (page owned by exercise-library, FR-EL-003) | *Historial* → `getExerciseSessionHistoryUseCase` (`?page=`) · *Gráficas* → `ExerciseChartsPanel` (initial data SSR from `getExerciseChartsUseCase`) · *Récords* → `getPersonalRecordsUseCase` (`RecordsTable` + `RepMaxTable`). Tab via `?tab=historial\|graficas\|records` |
| `/history` | `HistoryList` from `getHistoryUseCase` (`?program=`, `?routine=`, `?page=`); item → `/workouts/[id]` |
| `/workout/[id]` (live), summary, `/workouts/[id]` | Workout-tracking / social pages consume `recordBaselinePort`, `getWorkoutPrsUseCase`, `prCountPort` |
| `/settings` | *Exportar datos* → `/api/export/workouts.csv` |

API endpoints:

| Method | Path | Use case | Notes |
|---|---|---|---|
| GET | `/api/progress/baselines?exerciseIds=a,b&workoutId=…` | `RecordBaselinePort.getBaselines` | Exercise added mid-workout; `excludeWorkoutId = workoutId` |
| GET | `/api/progress/workouts/[id]/prs` | `GetWorkoutPrsUseCase` | `WorkoutSetPr[]` (summary refresh) |
| GET | `/api/progress/records/[exerciseId]` | `GetPersonalRecordsUseCase` | JSON for client tab switches |
| GET | `/api/progress/exercises/[exerciseId]/charts?range=3m` | `GetExerciseChartsUseCase` | Range change in `ExerciseChartsPanel` |
| GET | `/api/progress/muscle-distribution?period=7d` | `GetMuscleDistributionUseCase` | Period toggle |
| GET | `/api/progress/coach-summary?week=last\|current` | `GetWeeklyCoachSummaryUseCase` | `{ summary, tips, model, weekStart, remainingRegenerations } \| null` |
| POST | `/api/progress/coach-summary/regenerate` | `RegenerateWeeklySummaryUseCase` | 200 summary; 429 `WeeklySummaryLimitError` |
| GET | `/api/export/workouts.csv` | `ExportWorkoutsCsvUseCase` | `Content-Disposition: attachment; filename="gymup-workouts.csv"` |

All endpoints: 401 without a session; the user id comes from the session. Records and PRs of another user's workout are readable (read-all workouts, ADR-004); the coach summary and export are the session user's only.

### Testing (Phase 2)

| File | What |
|---|---|
| `tests/progress/personal-records.test.ts` | Every record type × applicable exercise type, ties, first exposure, warm-ups, e1RM bounds, rep-max table, sequence replay with uncheck (worked examples above) |
| `tests/progress/stats.test.ts` | `setVolume` per type with / without body weight, ISO weeks across a timezone boundary, `weeklyStreak` (current week met / not met, default 3), `muscleDistribution` normalization, `monthCalendar` deload days, `exerciseChartSeries` per type |
| `tests/progress/weekly-facts.test.ts` | Facts from a fixture week, recommendations order and cap, `validateCoachOutput` (121 words, 4 tips, foreign number "95"), template text |
| `tests/progress/workout-csv.test.ts` | Column order, `set_index` 0-based, `drop` → `dropset`, `distance_km`, timezone offset, quoting of notes with commas, quotes and newlines |
| `tests/progress/get-workout-prs.use-case.test.ts`, `record-baseline.service.test.ts`, `pr-count.service.test.ts` | Real SQLite; edit of a past workout re-derives PRs; baseline excludes the current workout |
| `tests/progress/get-weekly-coach-summary.use-case.test.ts` | Lazy generation and cache hit; no key → template; regeneration limit (3 → error); uses `TemplateCoachSummaryAdapter` (no mocks) |
| `tests/progress/phase-1-regression.test.ts` | Loads `tests/fixtures/phase-1.db`; history, `/progress` chart points and streak return the Phase 1 numbers |
| `tests/progress/perf-5000-sets.test.ts` | NFR-PR-P2-01 |
| `tests/supabase/rls-ai-weekly-summaries.integration.test.ts` | As a **non-owner**: cannot select, insert or update another user's summary |

Mothers (`tests/progress/mothers/`): `RecordSetMother` (`.set(weight, reps, { type?, setType?, completed?, workoutId? })`), `WorkoutStatMother` (`.completed({ daysAgo, isDeload? })`), `WeeklyFactsMother` (`.typicalWeek()`).

```ts
// tests/progress/personal-records.test.ts
import { describe, it, expect } from 'vitest';
import { detectPrsInSequence, type RecordBaseline } from '@/lib/contexts/progress/domain/personal-records';
import { RecordSetMother } from './mothers/record-set.mother';

const baseline: RecordBaseline = {
  exerciseId: 'bench', exerciseType: 'weight_reps', hasHistory: true,
  best: { heaviest_weight: 100, best_1rm: 116.67, best_set_volume: 600, best_session_volume: 2400 },
};

describe('detectPrsInSequence', () => {
  it('flags heaviest weight, set volume and session volume in order', () => {
    const sets = [[100, 5], [102.5, 3], [90, 8], [90, 8], [80, 10]].map(([w, r], i) =>
      RecordSetMother.set(w, r, { id: `s${i + 1}`, setNumber: i + 1 }));
    expect(detectPrsInSequence(baseline, sets)).toEqual([
      { setId: 's2', types: ['heaviest_weight'] },
      { setId: 's3', types: ['best_set_volume'] },
      { setId: 's5', types: ['best_set_volume', 'best_session_volume'] },
    ]);
  });
});
```


---

## Flows

- [view-progress.flow.md](./flows/view-progress.flow.md) (Phase 1)
- [live-pr-detection.flow.md](./flows/live-pr-detection.flow.md) (Phase 2, story 10.1)
- [view-exercise-stats.flow.md](./flows/view-exercise-stats.flow.md) (Phase 2, story 11.2)
- [weekly-coach-summary.flow.md](./flows/weekly-coach-summary.flow.md) (Phase 2, story 11.4)
