# Workout Tracking Context

Parent: [../readme.md](../readme.md) · PRD: [../../prd/features/workout-tracking.md](../../../prd/features/workout-tracking.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Purpose

Core workout loop: daily workout, log exercises, complete, view history.

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/workout-tracking/domain/`.

### `workout-tracking.types.ts`

```ts
// src/lib/contexts/workout-tracking/domain/workout-tracking.types.ts

import type { WorkoutStatus, RoutineType } from './workout-tracking.constants';

export interface Workout {
  id: string;
  user_id: string;
  routine_day_id: string;
  workout_date: string;
  status: WorkoutStatus;
  started_at: string;
  completed_at: string | null;
}

export interface WorkoutEntry {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number; // kg
  completed: boolean;
  notes: string | null;
}

export interface Routine {
  id: string;
  name: string;
  type: RoutineType;
}

export interface RoutineDay {
  id: string;
  routine_id: string;
  day_number: number;
  day_name: string;
  focus: string;
}

export interface RoutineExercise {
  id: string;
  routine_day_id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  exercise_order: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
}

export interface WorkoutCreateDTO {
  user_id: string;
  routine_day_id: string;
  workout_date: string;
}

export interface WorkoutUpdateDTO {
  status?: WorkoutStatus;
  completed_at?: string | null;
}

export interface WorkoutEntryUpsertDTO {
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number; // kg
  completed: boolean;
  notes: string | null;
}
```

### `workout-tracking.constants.ts`

```ts
// src/lib/contexts/workout-tracking/domain/workout-tracking.constants.ts

export const WorkoutStatuses = {
  InProgress: 'in_progress',
  Completed: 'completed',
} as const;
export type WorkoutStatus = (typeof WorkoutStatuses)[keyof typeof WorkoutStatuses];

export const RoutineTypes = {
  Hombre: 'hombre',
  Mujer: 'mujer',
} as const;
export type RoutineType = (typeof RoutineTypes)[keyof typeof RoutineTypes];

export const Weekdays = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
} as const;
export type Weekday = (typeof Weekdays)[keyof typeof Weekdays];

export const WorkoutEntryRules = {
  MinReps: 1,
  MaxReps: 100,
  MinWeight: 0, // kg
  MaxWeight: 500, // kg
  MaxNotesLength: 500,
  DefaultRestSeconds: 90,
  MinRestSeconds: 30,    // safety: avoid overtraining
  MaxRestSeconds: 600,   // 10 min upper bound
  MaxSetsPerExercise: 10,
} as const;

export const WorkoutSessionRules = {
  MinDurationMinutes: 15,    // safety: no rushed workouts
  MaxDurationMinutes: 180,   // 3 hours upper bound
  MinExercises: 3,            // quality threshold
  MaxExercises: 15,
  MinCompletedEntries: 1,    // to mark completed
  MinWarmupSeconds: 300,     // 5 min warmup recommended
  MinCooldownSeconds: 900,   // 15 min cooldown recommended
} as const;

export const TrainingFrequencyRules = {
  MinRestDaysPerWeek: 1,     // at least 1 rest day
  MaxConsecutiveDays: 4,    // avoid overtraining
  MinWeeksBetweenSameMuscle: 0, // same muscle can be trained on different days (push/pull/legs split)
  MaxVolumePerMusclePerWeek: 20, // sets per muscle per week (sports science consensus)
} as const;

export const CardioRules = {
  MinWarmupMinutes: 5,
  MaxWarmupMinutes: 15,
  MinCooldownMinutes: 15,
  MaxCooldownMinutes: 30,
  RecommendedMinPerDay: 20,  // cardio daily target
} as const;
```

### Entities

- `Workout` — a single workout session. Has `id`, `user_id`, `routine_day_id`, `workout_date`, `status`, `started_at`, `completed_at`.
- `WorkoutEntry` — one set of one exercise. Has `id`, `workout_id`, `exercise_id`, `set_number`, `reps`, `weight`, `completed`, `notes`.
- `Routine` — predefined template. Has `id`, `name`, `type`.
- `RoutineDay` — one day of a routine. Has `id`, `routine_id`, `day_number`, `day_name`, `focus`.
- `RoutineExercise` — exercise in a routine day. Has `id`, `routine_day_id`, `exercise_id`, `target_sets`, `target_reps`, `exercise_order`.
- `Exercise` — exercise definition. Has `id`, `name`, `muscle_group`.

### Value Objects

- `WorkoutStatus` — enum: `'in_progress'`, `'completed'`. Per `WorkoutStatuses`.
- `Weight` — decimal, stored in kg. Must be in range [`WorkoutEntryRules.MinWeight`, `WorkoutEntryRules.MaxWeight`].
- `Reps` — positive integer. Must be in range [`WorkoutEntryRules.MinReps`, `WorkoutEntryRules.MaxReps`].
- `SetNumber` — positive integer. Must be > 0 and ≤ `WorkoutEntryRules.MaxSetsPerExercise`.

### Invariants

#### Data integrity invariants
- One workout per user per day. Enforced by unique constraint `(user_id, workout_date, routine_day_id)`.
- `workout_date` MUST not be in the future.
- `status` MUST be `'in_progress'` or `'completed'`. Per `WorkoutStatuses`.
- A workout MUST have ≥ `WorkoutSessionRules.MinCompletedEntries` (1) completed entry before status can become `'completed'`.
- `completed_at` MUST be null when status is `'in_progress'`. MUST be set when status is `'completed'`.
- `weight` is ALWAYS stored in kg. Conversion happens at display layer only. Per [`ADR-006`](../decisions/006-kg-storage.md).
- Routine data is seed data. Users CANNOT create or modify routines. Per [`ADR-003`](../decisions/003-routines-seed-data.md).
- `routine_day.day_number` maps to weekday: 1=Mon, 5=Fri. 6-7 = weekend (rest).

#### Set-level invariants
- Each entry's `reps` MUST be in range [`WorkoutEntryRules.MinReps`, `WorkoutEntryRules.MaxReps`] = [1, 100].
- Each entry's `weight` MUST be in range [`WorkoutEntryRules.MinWeight`, `WorkoutEntryRules.MaxWeight`] = [0, 500] kg.
- Max `WorkoutEntryRules.MaxSetsPerExercise` (10) sets per exercise per workout. Safety: avoid overtraining.
- `notes` is optional. Max `WorkoutEntryRules.MaxNotesLength` (500) characters. Per [`PRD`](../../prd/features/workout-tracking.md) FR-WT-010.

#### Rest period invariants (safety)
- Rest between sets MUST be in range [`WorkoutEntryRules.MinRestSeconds`, `WorkoutEntryRules.MaxRestSeconds`] = [30, 600] seconds. Safety: 30s minimum prevents injury, 10min max prevents overtraining.
- Default rest per exercise: `WorkoutEntryRules.DefaultRestSeconds` (90s).
- Timer MUST NOT auto-start a new set — user confirms completion.

#### Session-level invariants
- Workout duration MUST be in range [`WorkoutSessionRules.MinDurationMinutes`, `WorkoutSessionRules.MaxDurationMinutes`] = [15, 180] minutes. Safety: no rushed workouts, no overtraining.
- A workout MUST include ≥ `WorkoutSessionRules.MinExercises` (3) exercises to be marked completed.
- A workout SHOULD NOT include > `WorkoutSessionRules.MaxExercises` (15) exercises.
- Warmup MUST be ≥ `WorkoutSessionRules.MinWarmupSeconds` (5 min). Displayed before first set.
- Cooldown MUST be ≥ `WorkoutSessionRules.MinCooldownSeconds` (15 min). Displayed after last set.

#### Training frequency invariants (overtraining prevention)
- User MUST have ≥ `TrainingFrequencyRules.MinRestDaysPerWeek` (1) rest day per week. Weekend default satisfies this.
- User MUST NOT train > `TrainingFrequencyRules.MaxConsecutiveDays` (4) days in a row. Warning shown on day 4.
- Weekly volume per muscle group MUST NOT exceed `TrainingFrequencyRules.MaxVolumePerMusclePerWeek` (20) sets. Warning shown.

#### Cardio invariants
- Warmup: [`CardioRules.MinWarmupMinutes`, `CardioRules.MaxWarmupMinutes`] = [5, 15] minutes.
- Cooldown: [`CardioRules.MinCooldownMinutes`, `CardioRules.MaxCooldownMinutes`] = [15, 30] minutes.
- Daily cardio target: `CardioRules.RecommendedMinPerDay` (20) minutes.

### Ports

- `WorkoutRepository` — create, getById, getByUserAndDate, update, delete.
- `WorkoutEntryRepository` — upsert, getByWorkoutId, delete.
- `RoutineRepository` — getByType, getDayByNumber.
- `ExerciseRepository` — getAll, getById.

---

## Application

### Use Cases

| Use case | Purpose | Status |
|----------|---------|--------|
| GetTodayWorkoutUseCase | Fetch today's routine_day + exercises for user's routine_type | planned |
| StartWorkoutUseCase | Create workouts record (status=in_progress) for today | planned |
| ResumeWorkoutUseCase | Load in_progress workout with existing entries | planned |
| LogSetUseCase | Insert/update workout_entry, convert weight to kg if needed | planned |
| CompleteWorkoutUseCase | Validate ≥1 entry, set status=completed, set completed_at | planned |
| GetWorkoutHistoryUseCase | Fetch paginated workouts for current user | planned |
| GetWorkoutDetailUseCase | Fetch single workout with all entries | planned |

### Orchestration

1. `GetTodayWorkoutUseCase`:
   - Get current weekday (1-5).
   - Call `RoutineRepository.getDayByNumber(routineType, dayNumber)`.
   - If weekend → return "rest day" with manual picker option.
   - Call `RoutineRepository.getExercises(dayId)`.
   - Call `WorkoutRepository.getByUserAndDate(userId, today)`.
   - Return routine + exercises + existing workout (if any).

2. `StartWorkoutUseCase`:
   - Validate no existing workout for today.
   - Call `WorkoutRepository.create({ user_id, routine_day_id, workout_date, status: 'in_progress' })`.
   - Return workout.

3. `LogSetUseCase`:
   - Validate reps > 0, weight ≥ 0.
   - Convert weight to kg if user's unit is lbs: `kg = lbs / 2.20462`.
   - Call `WorkoutEntryRepository.upsert({ workout_id, exercise_id, set_number, reps, weight_kg, completed, notes })`.
   - Return entry.

4. `CompleteWorkoutUseCase`:
   - Call `WorkoutEntryRepository.getByWorkoutId(workoutId)`.
   - Validate count ≥ 1.
   - Call `WorkoutRepository.update(workoutId, { status: 'completed', completed_at: now })`.
   - Return summary (exercises, sets, volume, duration).

---

## Infrastructure

Per [ADR-007](../decisions/007-repository-pattern.md), each repository has an abstract class + two implementations (Supabase, SQLite). Per [ADR-011](../decisions/011-implements-not-extends.md), concrete classes use `implements`, not `extends`.

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/workout-tracking/domain/ports/workout-repository.ts
abstract class WorkoutRepository {
  abstract create(data: WorkoutCreateDTO): Promise<Workout>;
  abstract getById(id: string): Promise<Workout | null>;
  abstract getByUserAndDate(userId: string, date: string): Promise<Workout | null>;
  abstract update(id: string, data: WorkoutUpdateDTO): Promise<Workout>;
  abstract delete(id: string): Promise<void>;
  abstract getHistoryByUser(userId: string, limit: number, offset: number): Promise<Workout[]>;
}

// src/lib/contexts/workout-tracking/domain/ports/workout-entry-repository.ts
abstract class WorkoutEntryRepository {
  abstract upsert(data: WorkoutEntryUpsertDTO): Promise<WorkoutEntry>;
  abstract getByWorkoutId(workoutId: string): Promise<WorkoutEntry[]>;
  abstract delete(id: string): Promise<void>;
}

// src/lib/contexts/workout-tracking/domain/ports/routine-repository.ts
abstract class RoutineRepository {
  abstract getByType(type: 'hombre' | 'mujer'): Promise<Routine>;
  abstract getDayByNumber(routineId: string, dayNumber: number): Promise<RoutineDay | null>;
  abstract getExercises(dayId: string): Promise<RoutineExercise[]>;
}

// src/lib/contexts/workout-tracking/domain/ports/exercise-repository.ts
abstract class ExerciseRepository {
  abstract getAll(): Promise<Exercise[]>;
  abstract getById(id: string): Promise<Exercise | null>;
}
```

### Supabase Implementations (Production)

```ts
// src/lib/contexts/workout-tracking/infrastructure/supabase/supabase-workout.repository.ts
class SupabaseWorkoutRepository implements WorkoutRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(data: WorkoutCreateDTO): Promise<Workout> {
    const { data: row, error } = await this.supabase
      .from('workouts')
      .insert({ user_id: data.user_id, routine_day_id: data.routine_day_id, workout_date: data.workout_date, status: 'in_progress' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  }

  async getByUserAndDate(userId: string, date: string): Promise<Workout | null> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('workout_date', date)
      .single();
    if (error && error.code === 'PGRST116') return null; // not found
    if (error) throw new Error(error.message);
    return data;
  }
  // ... other methods
}
```

### SQLite Implementations (Tests, E2E)

```ts
// src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository.ts
class SqliteWorkoutRepository implements WorkoutRepository {
  constructor(private db: Database) {}

  async create(data: WorkoutCreateDTO): Promise<Workout> {
    const id = crypto.randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO workouts (id, user_id, routine_day_id, workout_date, status, started_at)
      VALUES (?, ?, ?, ?, 'in_progress', datetime('now'))
    `);
    stmt.run(id, data.user_id, data.routine_day_id, data.workout_date);
    return this.getById(id);
  }

  async getByUserAndDate(userId: string, date: string): Promise<Workout | null> {
    const stmt = this.db.prepare('SELECT * FROM workouts WHERE user_id = ? AND workout_date = ?');
    const row = stmt.get(userId, date);
    return row || null;
  }
  // ... other methods
}
```

### Wiring (Per-Context Composition)

Per [ADR-010](../decisions/010-per-context-composition.md), no central root.

`src/lib/contexts/workout-tracking/workout-tracking.composition.ts`:

```ts
import { useSupabase, supabaseClient, sqliteDb } from '@/lib/config';
import { BrowserKeyValueStorage } from '@/lib/storage/BrowserKeyValueStorage';
import { SqliteKeyValueStorage } from '@/lib/storage/SqliteKeyValueStorage';
import { SupabaseWorkoutRepository } from './infrastructure/supabase/SupabaseWorkoutRepository';
import { SqliteWorkoutRepository } from './infrastructure/sqlite/SqliteWorkoutRepository';
// ... other imports
import { StartWorkoutUseCase } from './application/StartWorkoutUseCase';
import { LogSetUseCase } from './application/LogSetUseCase';
// ... other use cases

const workoutRepo: WorkoutRepository = useSupabase
  ? new SupabaseWorkoutRepository(supabaseClient)
  : new SqliteWorkoutRepository(sqliteDb);

const entryRepo: WorkoutEntryRepository = useSupabase
  ? new SupabaseWorkoutEntryRepository(supabaseClient)
  : new SqliteWorkoutEntryRepository(sqliteDb);

const routineRepo: RoutineRepository = useSupabase
  ? new SupabaseRoutineRepository(supabaseClient)
  : new SqliteRoutineRepository(sqliteDb);

const exerciseRepo: ExerciseRepository = useSupabase
  ? new SupabaseExerciseRepository(supabaseClient)
  : new SqliteExerciseRepository(sqliteDb);

const kvStorage: KeyValueStorage = useSupabase
  ? new BrowserKeyValueStorage()
  : new SqliteKeyValueStorage(sqliteDb);

export const startWorkoutUseCase = new StartWorkoutUseCase(workoutRepo, routineRepo);
export const logSetUseCase = new LogSetUseCase(entryRepo, kvStorage);
export const completeWorkoutUseCase = new CompleteWorkoutUseCase(workoutRepo, entryRepo);
```

---

## UI

### Components

- `ExerciseCard` — per-exercise input (sets, reps, weight, notes, checkmark).
- `WorkoutSummary` — post-workout summary (exercises, sets, volume, duration).
- `RestTimer` — countdown between sets (90s default).

### Interactive components (Astro islands)

Per Astro's island architecture, interactive components are hydrated as needed:

- `ExerciseCard.svelte` — Svelte island, set logging with auto-save.
- `RestTimer.svelte` — Svelte island, countdown timer (lightweight, ~3KB).
- `WorkoutSummary.svelte` — Svelte island, summary display.

### Pages

- `/dashboard` — SSR, today's workout.
- `/workout/[id]` — SSR, active workout logging.
- `/history` — SSR, paginated workout list.

---

## Testing

Per [ADR-009](../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations (SQLite repositories) with Object Mothers.

`src/test/contexts/workout-tracking/StartWorkoutUseCase.test.ts`:

```ts
import { faker } from '@faker-js/faker';
import { createTestDb } from '@/test/setup';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/SqliteWorkoutRepository';
import { SqliteRoutineRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/SqliteRoutineRepository';
import { StartWorkoutUseCase } from '@/lib/contexts/workout-tracking/application/StartWorkoutUseCase';
import { WorkoutMother } from '@/test/mothers/WorkoutMother';
import { RoutineMother } from '@/test/mothers/RoutineMother';

describe('StartWorkoutUseCase', () => {
  it('creates in_progress workout for today', async () => {
    const db = createTestDb();
    const workoutRepo = new SqliteWorkoutRepository(db);
    const routineRepo = new SqliteRoutineRepository(db);
    const useCase = new StartWorkoutUseCase(workoutRepo, routineRepo);

    const routine = await routineRepo.create(RoutineMother.male());
    const routineDay = await routineRepo.getDayByNumber(routine.id, 1);

    const result = await useCase.execute(faker.string.uuid(), routineDay!.id);

    expect(result.status).toBe('in_progress');
  });
});
```

Object Mothers in `src/test/mothers/`:

```ts
// WorkoutMother.ts
export class WorkoutMother {
  static create(overrides = {}): Workout {
    return {
      id: faker.string.uuid(),
      user_id: faker.string.uuid(),
      routine_day_id: faker.string.uuid(),
      workout_date: faker.date.recent().toISOString().split('T')[0],
      status: 'in_progress',
      started_at: faker.date.recent().toISOString(),
      completed_at: null,
      ...overrides,
    };
  }

  static completed(overrides = {}): Workout {
    return this.create({ status: 'completed', completed_at: faker.date.recent().toISOString(), ...overrides });
  }
}

// RoutineMother.ts
export class RoutineMother {
  static male(overrides = {}): Routine {
    return { id: faker.string.uuid(), name: 'Rutina Hombre', type: 'hombre', ...overrides };
  }
  static female(overrides = {}): Routine {
    return { id: faker.string.uuid(), name: 'Rutina Mujer', type: 'mujer', ...overrides };
  }
}
```

---

## Flows

- [start-workout.flow.md](./flows/start-workout.flow.md)
- [log-set.flow.md](./flows/log-set.flow.md)
