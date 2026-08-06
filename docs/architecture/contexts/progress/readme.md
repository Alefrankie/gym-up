# Progress & Charts Context

Parent: [../readme.md](../readme.md) · PRD: [../../prd/features/progress.md](../../../prd/features/progress.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

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
- Weight displayed in user's preferred unit. Volume in same unit. Per [`ADR-006`](../decisions/006-kg-storage.md).
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

Per [ADR-007](../decisions/007-repository-pattern.md).

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

Per [ADR-010](../decisions/010-per-context-composition.md), no central root.

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

### Interactive components (Astro islands)

- `ProgressChart.tsx` — React island, Chart.js rendering (per [ADR-002](../decisions/002-chartjs-react-island.md)).
- `ExerciseSelector.svelte` — Svelte island, dropdown with state.
- `CalendarGrid.svelte` — Svelte island, calendar with dots.
- `StreakCounter.svelte` — Svelte island, animated counter.

### Pages

- `/progress` — SSR, charts + calendar + streaks.

---

## Testing

Per [ADR-009](../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

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

## Flows

- [view-progress.flow.md](./flows/view-progress.flow.md)
