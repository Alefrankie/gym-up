# Workout Tracking Context

Parent: [../readme.md](../readme.md) · PRD: [../../../prd/features/workout-tracking.md](../../../prd/features/workout-tracking.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 1 (sections below) · 2 ([Phase 2](#phase-2)) |

> **Phase 2 supersedes parts of this Phase 1 spec.** Read [Phase 2](#phase-2) before implementing anything in this context. Phase 1 content is kept for history.
>
> | Phase 1 item | Phase 2 replacement |
> |---|---|
> | Session/set invariants: ≥ 3 exercises, duration ∈ [15, 180] min, rest ≥ 30 s, ≤ 10 sets/exercise, ≤ 15 exercises, warm-up/cool-down minimums, hard frequency rules | Relaxed per [ADR-016 §5](../../decisions/016-workout-data-model-v2.md). Only "≥ 1 completed set to finish" stays hard. See [Phase 2 → Constants](#workout-trackingconstantsts-phase-2) |
> | `routine_day.day_number` = weekday, rest-day screen, `GetTodayWorkoutUseCase` | Rotation ("next routine") owned by the **routines** context, [ADR-019](../../decisions/019-rotation-scheduling-and-onboarding.md) |
> | Svelte islands (`*.svelte`) | React islands only, [ADR-015](../../decisions/015-live-workout-react-island.md) |
> | `routine.repository.ts`, `Routine*` types in this context | Move to the **routines** context, [ADR-018](../../decisions/018-user-owned-programs.md). This context consumes `RoutinePlanPort` |
> | `Exercise` / `ExerciseRepository` in this context | **exercise-library** context, consumed through `ExerciseCatalogPort` ([ADR-017](../../decisions/017-exercise-catalog.md)) |
> | One workout per user per day (`UNIQUE(user_id, workout_date, routine_day_id)`) | At most one `in_progress` workout per user ([ADR-016 §2](../../decisions/016-workout-data-model-v2.md)) |
> | `ExerciseCard` + `auto-save.ts` + `RestTimer` | `LiveWorkout` island + outbox + `use-rest-timer` ([ADR-015](../../decisions/015-live-workout-react-island.md), [ADR-025](../../decisions/025-offline-live-workout.md)) |
> | snake_case types, `getById`, `src/test/` | Code wins: Drizzle camelCase types from `@db/schema`, `findById`, `tests/workout-tracking/` ([phase-2 rules](../../../stories/phase-2/readme.md#2-code-is-the-source-of-truth-for-conventions)) |

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
- `weight` is ALWAYS stored in kg. Conversion happens at display layer only. Per [`ADR-006`](../../decisions/006-kg-storage.md).
- Routine data is seed data. Users CANNOT create or modify routines. Per [`ADR-003`](../../decisions/003-routines-seed-data.md).
- `routine_day.day_number` maps to weekday: 1=Mon, 5=Fri. 6-7 = weekend (rest).

#### Set-level invariants
- Each entry's `reps` MUST be in range [`WorkoutEntryRules.MinReps`, `WorkoutEntryRules.MaxReps`] = [1, 100].
- Each entry's `weight` MUST be in range [`WorkoutEntryRules.MinWeight`, `WorkoutEntryRules.MaxWeight`] = [0, 500] kg.
- Max `WorkoutEntryRules.MaxSetsPerExercise` (10) sets per exercise per workout. Safety: avoid overtraining.
- `notes` is optional. Max `WorkoutEntryRules.MaxNotesLength` (500) characters. Per [`PRD`](../../../prd/features/workout-tracking.md) FR-WT-010.

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
   - Convert weight to kg if user's unit is lbs: `kg = lbs * 0.45359237` (Phase 2: shared helper `src/lib/units/weight.ts`, story 9.4).
   - Call `WorkoutEntryRepository.upsert({ workout_id, exercise_id, set_number, reps, weight_kg, completed, notes })`.
   - Return entry.

4. `CompleteWorkoutUseCase`:
   - Call `WorkoutEntryRepository.getByWorkoutId(workoutId)`.
   - Validate count ≥ 1.
   - Call `WorkoutRepository.update(workoutId, { status: 'completed', completed_at: now })`.
   - Return summary (exercises, sets, volume, duration).

---

## Infrastructure

Per [ADR-007](../../decisions/007-repository-pattern.md), each repository has an abstract class + two implementations (Supabase, SQLite). Per [ADR-011](../../decisions/011-implements-not-extends.md), concrete classes use `implements`, not `extends`.

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

Per [ADR-010](../../decisions/010-per-context-composition.md), no central root.

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

### Interactive components (Svelte)

The Astro and React island versions of these components were removed in Phase 1 of the mobile migration (see the `pre-migration` git tag); they are rewritten as Svelte 5 components in `apps/app`. The live workout screen already exists as `apps/app/src/routes/workout/[id]/+page.svelte` (local-first, with the offline outbox of ADR-025 as amended by ADR-027). Planned components:

- `ExerciseCard.svelte` — Svelte island, set logging with auto-save.
- `RestTimer.svelte` — Svelte island, countdown timer (lightweight, ~3KB).
- `WorkoutSummary.svelte` — Svelte island, summary display.

### Pages

- `/dashboard` — SSR, today's workout.
- `/workout/[id]` — SSR, active workout logging.
- `/history` — SSR, paginated workout list.

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations (SQLite repositories) with Object Mothers.

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

- [start-workout.flow.md](./flows/start-workout.flow.md) (superseded in Phase 2)
- [log-set.flow.md](./flows/log-set.flow.md) (superseded in Phase 2)

---
---

## Phase 2

PRD: [FR-WT-018 … FR-WT-045, NFR-WT-P2-01 … 05](../../../prd/features/workout-tracking.md#phase-2--functional-requirements) · Decisions: [ADR-015](../../decisions/015-live-workout-react-island.md), [ADR-016](../../decisions/016-workout-data-model-v2.md), [ADR-017](../../decisions/017-exercise-catalog.md), [ADR-018](../../decisions/018-user-owned-programs.md), [ADR-019](../../decisions/019-rotation-scheduling-and-onboarding.md), [ADR-020](../../decisions/020-personal-records.md), [ADR-021](../../decisions/021-progression-engine.md), [ADR-025](../../decisions/025-offline-live-workout.md) · Schema: [database-schema.md → Phase 2 Migrations](../../database-schema.md#phase-2-migrations) · Stories: [7.1](../../../stories/phase-2/round-7/story-7.1.md), [9.1](../../../stories/phase-2/round-9/story-9.1.md), [9.2](../../../stories/phase-2/round-9/story-9.2.md), [9.3](../../../stories/phase-2/round-9/story-9.3.md), [9.4](../../../stories/phase-2/round-9/story-9.4.md), [9.5](../../../stories/phase-2/round-9/story-9.5.md), [12.3](../../../stories/phase-2/round-12/story-12.3.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |

### Purpose (Phase 2)

A Hevy-grade live session: start a workout four ways, edit exercises on the fly (add, remove, reorder, replace, supersets), log every set type and exercise type with RPE and a "Previous" column, run per-exercise rest timers, finish with a summary, and edit or delete past workouts. The live session runs in one React island backed by an outbox that keeps working offline.

What this context **owns**: `workouts`, `workout_exercises`, `workout_entries` (sets), the training-settings columns of `profiles`, the live-workout island and its sync protocol, and the gym tools (plate calculator, warm-up generator).

What it **consumes** (through ports, never by importing another context's repositories):

| Need | Provider context | Port |
|---|---|---|
| Exercise metadata (type, equipment, muscles, ownership) | exercise-library | `ExerciseCatalogPort` |
| Routine plan (targets, rest, supersets, notes) | routines | `RoutinePlanPort` |
| Load suggestions, deload state | progression | `SuggestionPort` |
| PR baselines for live badges | progress | `RecordBaselinePort` |

What it **provides**: `WorkoutSnapshotPort` → routines (*Guardar como rutina*, [FR-RT-018](../../../prd/features/routines.md#fr-rt-018), story 9.3).

Convention (shared with the [exercise-library](../exercise-library/readme.md), [routines](../routines/readme.md) and [progression](../progression/readme.md) readmes): a cross-context port is **declared by the providing context** and exported as a singleton from its composition root. Consumers depend only on the abstract class and inject the instance.

---

### Domain

Files in `src/lib/contexts/workout-tracking/domain/`. Types come from Drizzle (`@db/schema`, camelCase). Pure modules (no I/O) live next to the types so both the server and the island can import them.

#### Drizzle schema (`db/schema.ts`, story 7.1)

DDL source of truth: [database-schema.md → 004](../../database-schema.md#phase-2-migrations) and 011 (tombstones).

```ts
// db/schema.ts — Phase 2 changes (story 7.1; deletedAt added in story 12.3)
export const workouts = sqliteTable('workouts', {
  // ...Phase 1 columns (id, userId, workoutDate, status, startedAt, completedAt)
  routineDayId: text('routine_day_id').references(() => routineDays.id), // nullable: empty workout
  name: text('name').notNull().default('Entrenamiento libre'),
  notes: text('notes'),
  programId: text('program_id').references(() => routines.id, { onDelete: 'set null' }),
  isDeload: integer('is_deload', { mode: 'boolean' }).notNull().default(false),
  readinessScore: real('readiness_score'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => [
  uniqueIndex('uq_workouts_one_in_progress').on(t.userId).where(sql`status = 'in_progress'`),
  index('idx_workouts_completed').on(t.userId, t.completedAt).where(sql`status = 'completed'`),
]);

export const workoutExercises = sqliteTable('workout_exercises', {
  id: text('id').primaryKey(),                                  // client UUID (ADR-025 §3)
  workoutId: text('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => exercises.id),
  position: integer('position').notNull(),                      // 1-based, dense
  supersetGroup: integer('superset_group'),
  restSeconds: integer('rest_seconds'),                         // 0..600, NULL = profile default
  notes: text('notes'),                                         // ≤ 500
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),   // story 12.3
}, (t) => [index('idx_workout_exercises_workout').on(t.workoutId, t.position)]);

export const workoutEntries = sqliteTable('workout_entries', {
  // ...Phase 1 columns (id, workoutId, exerciseId, setNumber, completed, notes, createdAt)
  workoutExerciseId: text('workout_exercise_id').references(() => workoutExercises.id, { onDelete: 'cascade' }),
  setType: text('set_type', { enum: ['normal', 'warmup', 'drop', 'failure'] }).notNull().default('normal'),
  reps: integer('reps'),                                        // now nullable
  weight: real('weight').notNull().default(0),                  // integer → real (fractional plates)
  rpe: real('rpe'),
  durationSeconds: integer('duration_seconds'),
  distanceM: real('distance_m'),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),   // story 12.3
});

export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;
```

Decision: `updated_at`, `deleted_at` and `workout_entries.completed_at` use `timestamp_ms` in SQLite (not the seconds `timestamp` mapping of the schema doc), because last-write-wins and set ordering compare client millisecond clocks. Postgres `TIMESTAMPTZ` already has sub-millisecond precision. (Simplest option that keeps LWW correct.)

`profiles` gains the training-settings columns of [FR-WT-037](../../../prd/features/workout-tracking.md#fr-wt-037): `defaultRestSeconds`, `barWeightKg`, `availablePlatesKg` (JSON text), `rpeEnabled`, `progressionEnabled`, `readinessEnabled`, `timezone`.

#### `workout-tracking.types.ts` (Phase 2)

```ts
// src/lib/contexts/workout-tracking/domain/workout-tracking.types.ts (Phase 2 additions)
import type { Workout, WorkoutExercise, WorkoutEntry } from '@db/schema';
import type { SetType, WeightUnit } from './workout-tracking.constants';
// Provider-owned read types (ports are declared by the providing context):
import type { CatalogExercise } from '@/lib/contexts/exercise-library/domain/exercise-library.types';
import type { ExerciseSuggestion } from '@/lib/contexts/progression/domain/progression.types';
import type { RecordBaseline } from '@/lib/contexts/progress/domain/ports/record-baseline.port';

/** Domain name for a `workout_entries` row in Phase 2. */
export type WorkoutSet = WorkoutEntry;

/** Metric columns of a set, in storage units: kg, seconds, metres (ADR-006). */
export interface SetMetrics {
  weight: number | null;          // kg. Negative only for assisted_bodyweight (assistance)
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  rpe: number | null;             // 6.0–10.0, step 0.5
}
export type SetMetricField = keyof SetMetrics;

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  sets: WorkoutSet[];             // live rows (deletedAt IS NULL), ordered by setNumber
}

/** workout → workout_exercises[] → sets[] (ADR-016 §1). Live rows only, ordered by position. */
export interface WorkoutAggregate {
  workout: Workout;
  exercises: WorkoutExerciseWithSets[];
}

/** One row of the "Anterior" column (FR-WT-029). */
export interface PreviousSet extends SetMetrics {
  setNumber: number;
  setType: SetType;
  workoutId: string;
  completedAt: Date;
}

/** profiles columns of FR-WT-037, parsed. */
export interface TrainingSettings {
  weightUnit: WeightUnit;
  defaultRestSeconds: number;     // 0 = timer off
  barWeightKg: number;
  availablePlatesKg: number[];    // sorted desc
  rpeEnabled: boolean;
  progressionEnabled: boolean;
  readinessEnabled: boolean;
}

/** Output of buildWorkoutSkeleton(); input of StartWorkoutUseCase. */
export interface WorkoutSkeleton {
  name: string;
  routineDayId: string | null;
  programId: string | null;
  exercises: Array<{
    id: string;
    exerciseId: string;
    position: number;
    supersetGroup: number | null;
    restSeconds: number | null;
    notes: string | null;
    sets: Array<{ id: string; setNumber: number; setType: SetType }>;
  }>;
}

/** Result of every idempotent upsert (ADR-025 §3, §5). */
export type UpsertOutcome = 'created' | 'updated' | 'stale';
export interface UpsertResult<T> { row: T; outcome: UpsertOutcome }

/** JSON prop of the LiveWorkout island (ADR-015 §4). Dates are epoch ms. */
export interface LiveWorkoutInitialState {
  mode: 'live' | 'edit';
  workout: {
    id: string; name: string; notes: string | null; status: 'in_progress' | 'completed';
    startedAt: number; completedAt: number | null; routineDayId: string | null;
    programId: string | null; isDeload: boolean; readinessScore: number | null; updatedAt: number;
  };
  exercises: Array<{
    id: string; exerciseId: string; exercise: CatalogExercise; position: number;
    supersetGroup: number | null; restSeconds: number | null; notes: string | null;
    routineNotes: string | null;                     // "Nota de la rutina" (FR-WT-026)
    targetReps: { min: number; max: number } | null; // placeholder "8–12" (FR-WT-030)
    updatedAt: number;
    sets: Array<SetMetrics & {
      id: string; setNumber: number; setType: SetType;
      completed: boolean; completedAt: number | null; updatedAt: number;
    }>;
  }>;
  previous: Record<string, PreviousSet[]>;            // by exerciseId (FR-WT-029)
  suggestions: Record<string, ExerciseSuggestion>;    // by exerciseId (FR-PG-001); {} when progression is off
  prBaselines: Record<string, RecordBaseline>;        // by exerciseId (ADR-020 §4)
  settings: TrainingSettings;
  showReadinessStep: boolean;                         // readinessEnabled && readinessScore === null && no completed set
}
```

`CatalogExercise` (exercise-library), `ExerciseSuggestion` (progression) and `RecordBaseline` (progress) are owned by their providers; this context never redefines them. `exercise-library.constants.ts` (`ExerciseType`, `Equipment`, `MuscleGroup`, `ExerciseTypeMetricRules`) is importable as a pure shared kernel.

#### `workout-tracking.constants.ts` (Phase 2)

Story 7.1 updates the values per [ADR-016 §5](../../decisions/016-workout-data-model-v2.md). Removed keys: `WorkoutSessionRules.MinDurationMinutes`, `MinExercises` and `MaxDurationMinutes` (replaced by the soft `ForgotToFinishMinutes`). No production code reads the removed keys today.

```ts
// src/lib/contexts/workout-tracking/domain/workout-tracking.constants.ts (Phase 2)

export const WorkoutStatuses = { InProgress: 'in_progress', Completed: 'completed' } as const;
export type WorkoutStatus = (typeof WorkoutStatuses)[keyof typeof WorkoutStatuses];

export const WeightUnits = { Kg: 'kg', Lbs: 'lbs' } as const;
export type WeightUnit = (typeof WeightUnits)[keyof typeof WeightUnits];

export const SetTypes = {
  Normal: 'normal',
  Warmup: 'warmup',
  Drop: 'drop',
  Failure: 'failure',
} as const;
export type SetType = (typeof SetTypes)[keyof typeof SetTypes];

/** UI labels (ADR-016 §4). Normal sets show their ordinal among normal sets instead. */
export const SetTypeLabels = { warmup: 'W', drop: 'D', failure: 'F' } as const;

export const WorkoutStartModes = {
  NextRoutine: 'next_routine', // FR-WT-018 (1)
  Routine: 'routine',          // FR-WT-018 (2)
  Empty: 'empty',              // FR-WT-018 (3)
  Repeat: 'repeat',            // FR-WT-018 (4)
} as const;
export type WorkoutStartMode = (typeof WorkoutStartModes)[keyof typeof WorkoutStartModes];

export const WorkoutEntryRules = {
  MinReps: 1,
  MaxReps: 100,
  MinWeight: 0,               // kg (assisted_bodyweight allows down to -MaxWeight)
  MaxWeight: 500,             // kg
  MaxNotesLength: 500,
  DefaultRestSeconds: 90,
  MinRestSeconds: 0,          // was 30. 0 = timer off (Hevy "Off")
  MaxRestSeconds: 600,
  RestAdjustStepSeconds: 15,  // −15 s / +15 s buttons (FR-WT-034)
  MaxSetsPerExercise: 20,     // was 10
  MinRpe: 6,
  MaxRpe: 10,
  RpeStep: 0.5,
  MinDurationSeconds: 1,
  MaxDurationSeconds: 86_400,
} as const;

export const WorkoutSessionRules = {
  MinCompletedEntries: 1,        // HARD: required to finish (kept)
  MaxExercises: 30,              // was 15
  ForgotToFinishMinutes: 180,    // SOFT: "¿Olvidaste terminar?" on finish (was MaxDurationMinutes, hard)
  MinWarmupSeconds: 300,         // display-only reminder (FR-WT-015)
  MinCooldownSeconds: 900,       // display-only reminder (FR-WT-015)
  MaxNameLength: 60,
  DefaultName: 'Entrenamiento libre',
  ClockSkewToleranceMs: 300_000, // completedAt may be ≤ now + 5 min
} as const;

/** Warm-up generator (FR-WT-041): % of the first working weight × reps. */
export const WarmupScheme = [
  { percent: 40, reps: 10 },
  { percent: 60, reps: 5 },
  { percent: 80, reps: 3 },
] as const;

export const TrainingSettingsDefaults = {
  kg: { barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lbs: { barWeight: 45, plates: [45, 35, 25, 10, 5, 2.5] }, // display units; stored converted to kg
} as const;

// Kept only for Phase 1 code until story 8.3 removes the weekday lookup (rotation, ADR-019):
// RoutineTypes, Weekdays.
// TrainingFrequencyRules and CardioRules are no longer enforced here. Frequency and volume become
// soft warnings computed by progression (ADR-022 §3); cardio stays a display hint (FR-WT-043).
```

Decision: workout names are 1–60 characters after trim, like routine names (FR-RT-002). An empty name falls back to the routine name or `DefaultName`. (Simplest option.)

#### Pure domain modules

| File | Export | Purpose | Story |
|---|---|---|---|
| `set-metrics.ts` | `validateSetMetrics(exerciseType, metrics, { completed })` | Required / forbidden metrics per `exercise_type` ([ADR-016 §3](../../decisions/016-workout-data-model-v2.md)) plus ranges | 7.1 |
| `set-label.ts` | `deriveSetLabels(sets)` | `W` / `D` / `F` / ordinal among normal sets ([ADR-016 §4](../../decisions/016-workout-data-model-v2.md)) | 7.1 |
| `workout-skeleton.ts` | `buildWorkoutSkeleton(source, newId)` | Exercises + empty sets from a routine plan, a past workout, or nothing (FR-WT-018) | 9.1 |
| `superset.ts` | `normalizeSupersets(exercises)` | Keeps superset groups contiguous; dissolves single-member groups | 9.1 |
| `previous-set.ts` | `pickPreviousSet(previous, setNumber)` | Same `set_number`, else the last one (FR-WT-029) | 9.2 |
| `plate-calculator.ts` | `calculatePlates(target, bar, plates)` | Plates per side, greedy largest first; nearest lower/upper loadable weight (FR-WT-040) | 9.5 |
| `warmup-generator.ts` | `generateWarmupSets(firstWorkingWeight, bar, plates)` | `WarmupScheme` rounded to loadable weights, skipping anything below the empty bar (FR-WT-041) | 9.5 |

Decision: the plate calculator and warm-up generator compute in the **display unit** (plates converted from kg and rounded to 0.01), so lbs users never see float drift such as 44.99 lb. (Simplest correct option.)

```ts
// src/lib/contexts/workout-tracking/domain/set-metrics.ts
import type { ExerciseType } from '@/lib/contexts/exercise-library/domain/exercise-library.constants';
import { ExerciseTypeMetricRules } from '@/lib/contexts/exercise-library/domain/exercise-library.constants';

export type SetMetricErrorCode = 'required' | 'forbidden' | 'out_of_range';
export interface SetMetricError { field: SetMetricField; code: SetMetricErrorCode }
export type SetMetricsResult = { ok: true } | { ok: false; errors: SetMetricError[] };

/**
 * Pure. Used by the reducer on check (FR-WT-033: invalid rows shake) and by UpsertSetUseCase.
 * - Ranges and forbidden fields are checked on every call.
 * - Required fields are checked only when `completed` is true (a draft row may be partial).
 */
export function validateSetMetrics(
  exerciseType: ExerciseType,
  metrics: SetMetrics,
  options: { completed: boolean },
): SetMetricsResult;
```

The required / optional / forbidden matrix comes from `ExerciseTypeMetricRules` ([exercise-library constants](../exercise-library/readme.md)); `validateSetMetrics` adds the ranges and the `completed` switch. A forbidden weight is `0` (NOT NULL column); other forbidden metrics are `NULL`.

| `exercise_type` | Required when completed | Forbidden | Weight range (kg) |
|---|---|---|---|
| `weight_reps` | `weight`, `reps` | `durationSeconds`, `distanceM` | [0, 500] |
| `bodyweight_reps` | `reps` | `weight ≠ 0`, `durationSeconds`, `distanceM` | 0 |
| `weighted_bodyweight` | `reps`, `weight` | `durationSeconds`, `distanceM` | [0, 500] |
| `assisted_bodyweight` | `reps`, `weight` | `durationSeconds`, `distanceM` | [−500, 0] |
| `duration` | `durationSeconds` | `reps`, `distanceM` | optional, [0, 500] |
| `distance_duration` | `distanceM`, `durationSeconds` | `weight ≠ 0`, `reps` | 0 |
| `weight_distance` | `weight`, `distanceM` | `reps`, `durationSeconds` | [0, 500] |

Shared ranges: reps [1, 100], duration [1, 86 400] s, distance > 0 m, RPE [6, 10] in 0.5 steps. RPE is accepted on every type regardless of `rpe_enabled`, because settings can differ between devices.

### Entities (Phase 2)

- `Workout` (aggregate root) — `id`, `userId`, `routineDayId | null`, `programId | null`, `name`, `notes`, `workoutDate`, `status`, `startedAt`, `completedAt`, `isDeload`, `readinessScore`, `updatedAt`. Duration is derived (`completedAt − startedAt`), never stored.
- `WorkoutExercise` — `id`, `workoutId`, `exerciseId`, `position`, `supersetGroup`, `restSeconds`, `notes`, `updatedAt`, `deletedAt`. The same `exerciseId` may appear twice in one workout.
- `WorkoutSet` (`workout_entries`) — `id`, `workoutId`, `workoutExerciseId`, `exerciseId` (denormalized), `setNumber`, `setType`, metrics (`weight`, `reps`, `durationSeconds`, `distanceM`, `rpe`), `completed`, `completedAt`, `notes`, `updatedAt`, `deletedAt`.

### Value Objects (Phase 2)

- `SetType` — `normal | warmup | drop | failure` (`SetTypes`).
- `SetLabel` — derived string (`W`, `D`, `F`, `1`, `2`…), never stored.
- `SetMetrics` — validated by `validateSetMetrics` against the exercise type.
- `Rpe` — 6.0–10.0, step 0.5.
- `RestSeconds` — integer in [0, 600]; 0 = off. Resolution: `workout_exercises.rest_seconds` (copied from `routine_exercises.rest_seconds` at start) → `profiles.default_rest_seconds`.
- `WorkoutStartMode` — `next_routine | routine | empty | repeat`.

### Invariants (Phase 2)

#### Data integrity
- At most **one `in_progress` workout per user**. Enforced by `StartWorkoutUseCase` and the partial unique index `uq_workouts_one_in_progress` ([ADR-016 §2](../../decisions/016-workout-data-model-v2.md)).
- `workout_entries.exercise_id` MUST equal its parent `workout_exercises.exercise_id`. The repository copies it from the parent; callers never pass it. `ReplaceExerciseUseCase` updates both in one transaction.
- `workout_exercises.position` is 1-based and **dense** among live rows of a workout. Every add, remove and reorder re-densifies.
- `workout_entries.set_number` is 1-based and dense among live sets of a `workout_exercise`. It counts every set type ([ADR-016 §4](../../decisions/016-workout-data-model-v2.md)).
- Exercises sharing a non-null `superset_group` occupy contiguous positions. A group with one member is set to `NULL` (`normalizeSupersets`). Decision: dragging an exercise out of its group, or removing its neighbour, removes it from the superset (Hevy behaviour).
- `completed = true` ⇔ `completed_at IS NOT NULL` (FR-WT-033).
- `status = 'completed'` ⇒ `completed_at` is set, `completed_at ≥ started_at` and `completed_at ≤ now + ClockSkewToleranceMs`.
- `workout_date` = the calendar date of `started_at` in `profiles.timezone`. It is recomputed when an edit changes `started_at` (FR-WT-039).
- After the 004 backfill, application code treats `workout_exercise_id` as required.
- Every read filters `deleted_at IS NULL` (story 12.3). A tombstoned row is never resurrected by a stale upsert ([ADR-025 §5](../../decisions/025-offline-live-workout.md)).
- Weight is stored in kg and distance in m ([ADR-006](../../decisions/006-kg-storage.md)). The island state uses storage units too; conversion happens only in inputs and labels.

#### Session (relaxed, [ADR-016 §5](../../decisions/016-workout-data-model-v2.md))
- **Hard:** ≥ `WorkoutSessionRules.MinCompletedEntries` (1) completed set to finish.
- **Hard limits:** ≤ `MaxExercises` (30) live exercises; ≤ `MaxSetsPerExercise` (20) live sets per exercise.
- **Soft:** elapsed > `ForgotToFinishMinutes` (180) → "¿Olvidaste terminar?" with an editable end time. Under 15 min is allowed.
- Warm-up, cool-down and cardio: display-only reminders.
- Frequency, weekly volume and weight-jump rules never block logging. `HealthRules` apply to **suggestions only** ([ADR-021 §4](../../decisions/021-progression-engine.md)); warnings come from progression ([ADR-022 §3](../../decisions/022-readiness-and-recovery.md)).

#### Sync ([ADR-025](../../decisions/025-offline-live-workout.md))
- Every client-created row has a client UUID, and every create is an idempotent upsert by `id`.
- Last-write-wins per row by `updated_at`: an upsert whose `updatedAt` is older than the stored row returns `outcome: 'stale'` and changes nothing.
- Ownership is checked through the parent workout on every write (write-own, read-all, [ADR-004](../../decisions/004-rls-visibility.md)).

### Ports (Phase 2)

Own repositories (`domain/*.repository.ts`):

| Port | Methods | Notes |
|---|---|---|
| `WorkoutRepository` (v2) | `findById`, `findInProgressByUser`, `createIfAbsent`, `createFromSkeleton`, `update`, `delete`, `findAggregate`, `finish`, `findLastCompletedSetsByExercise`, `findPreviousCompletedByRoutineDay`, `getHistoryByUser`, `getHistoryCountByUser` | Phase 1 `addEntry`, `updateEntry`, `findEntries`, `findByUserAndDate`, `getEntriesWithExercises` stay until stories 9.2 / 9.3 remove their callers |
| `WorkoutExerciseRepository` (new) | `findById`, `listByWorkout`, `upsert`, `remove`, `reorder`, `replaceExercise`, `findSetById`, `upsertSet`, `removeSet`, `purgeTombstones` | Sets are children of a workout exercise, so their writes live here |
| `ProfileRepository` | `update` patch widened to the FR-WT-037 columns | Existing `profile.repository.ts` |

Consumed ports. Each is declared by its provider and imported as a singleton from the provider's composition root; the provider readme is the source of truth for the signature.

| Port | Declared in | Methods used here | Used by | Available from |
|---|---|---|---|---|
| `ExerciseCatalogPort` | exercise-library ([readme](../exercise-library/readme.md), [ADR-017](../../decisions/017-exercise-catalog.md)) | `findById(id)`, `findByIds(ids)` (any exercise, archived and family-owned included), `findUsableByIds(ids, userId)` (system, or own and not archived; a missing id = not usable) | Start, add, replace (`findUsableByIds`); live state, upsert set (`findByIds` / `findById` for `exerciseType`) | 7.3 |
| `RoutinePlanPort` | routines ([readme](../routines/readme.md), [ADR-018](../../decisions/018-user-owned-programs.md)) | `findRoutinePlan(routineDayId)` → `RoutinePlan { routineDayId, programId, ownerId, name, notes, exercises[] }` | Start (skeleton, ownership), live state (routine notes, rep range) | 8.1 |
| `SuggestionPort` | `progression/domain/ports/suggestion.port.ts` ([readme](../progression/readme.md), [ADR-021](../../decisions/021-progression-engine.md)) | `getSuggestions(userId, exerciseIds, { routineDayId, isDeload, readinessScore }, now?)` → `ExerciseSuggestion[]`; `isDeloadActive(userId, now?)` | Live state (chips, prefill); start (`is_deload`) | 10.2 (null adapter before) |
| `RecordBaselinePort` | `progress/domain/ports/record-baseline.port.ts` ([ADR-020 §4](../../decisions/020-personal-records.md)) | `getBaselines(userId, exerciseIds, { excludeWorkoutId })` → `Record<exerciseId, RecordBaseline>` | Live state (PR badges) | 10.1 (null adapter before) |

Provided port:

| Port | Declared in | Methods | Consumer | Story |
|---|---|---|---|---|
| `WorkoutSnapshotPort` | `workout-tracking/domain/ports/workout-snapshot.port.ts` | `findCompletedSnapshot(workoutId)` → `WorkoutSnapshot \| undefined` (shape fixed in the [routines readme](../routines/readme.md)) | routines (`SaveWorkoutAsRoutine…`, FR-RT-018) | 9.3 |

Decision: until the provider story lands, the composition wires a **null-object adapter** in `infrastructure/null-adapters/` (`NoSuggestionAdapter` returns `[]` and `false`; `NoRecordBaselineAdapter` returns `{}`). They are production code, not test doubles, so ADR-009 still holds. (Simplest option that lets Round 9 ship before Round 10.)

Decision: `RecordBaselinePort` has no ADR-fixed signature yet; the one above is the contract workout-tracking needs, and the progress context readme owns its final form. `RecordBaseline = { hasHistory: boolean; best: Partial<Record<RecordType, number>> }`, where `hasHistory = false` means first exposure, so no badges ([ADR-020 §3](../../decisions/020-personal-records.md)).

---

### Application (Phase 2)

Files: `src/lib/contexts/workout-tracking/application/<verb-noun>.use-case.ts`, class `XxxUseCase` with `execute(input)` and an injectable `now?: Date`. Errors are classes exported from the use-case file (Phase 1 pattern, e.g. `WorkoutNotFoundError`).

#### Use Cases

| Use case | Purpose | Story | Status |
|---|---|---|---|
| `StartWorkoutUseCase` (v2) | Idempotent start in 4 modes (FR-WT-018); one in-progress rule (FR-WT-019) | 9.1 | planned |
| `RepeatWorkoutUseCase` | Mode 4: skeleton from an own completed workout, then `StartWorkoutUseCase` | 9.1 | planned |
| `GetActiveWorkoutUseCase` | The user's `in_progress` workout `{ id, name, startedAt }` for the banner (FR-WT-019) | 9.1 | planned |
| `GetLiveWorkoutStateUseCase` | Builds `LiveWorkoutInitialState` (island prop); optional `onlyExerciseIds` slice for exercises added mid-session | 9.1 (previous 9.2, baselines 10.1, suggestions 10.2) | planned |
| `AddExercisesUseCase` | Upsert one or more `workout_exercises` with their empty sets at the end (FR-WT-021) | 9.1 | planned |
| `RemoveExerciseUseCase` | Remove an exercise and its sets (tombstone from 12.3); re-densify; normalize supersets (FR-WT-022) | 9.1 | planned |
| `ReorderExercisesUseCase` | Rewrite `position` from an ordered id list (FR-WT-023) | 9.1 | planned |
| `ReplaceExerciseUseCase` | Swap `exercise_id` on the exercise and its sets; keep or clear values by type (FR-WT-024) | 9.1 | planned |
| `SetSupersetUseCase` | Set or clear `superset_group` on one row (FR-WT-025) | 9.1 | planned |
| `UpdateWorkoutExerciseUseCase` | Session notes (FR-WT-026) and rest seconds (FR-WT-034) | 9.1 (rest 9.2) | planned |
| `DiscardWorkoutUseCase` | Delete an `in_progress` workout and all its rows (FR-WT-038) | 9.1 | planned |
| `UpsertSetUseCase` | Idempotent create/update of a set, LWW by `updatedAt` (FR-WT-027..033, [ADR-025](../../decisions/025-offline-live-workout.md)) | 9.2 | planned |
| `DeleteSetUseCase` | Remove a set (tombstone from 12.3); renumber the rest (FR-WT-032) | 9.2 | planned |
| `GetPreviousValuesUseCase` | Last completed sets per exercise, excluding a workout (FR-WT-029) | 9.2 | planned |
| `FinishWorkoutUseCase` | Resolve unchecked and empty sets, require ≥ 1 completed, complete (FR-WT-035) | 9.3 | planned |
| `GetWorkoutSummaryUseCase` | Summary v2 stats (FR-WT-036). The PR list comes from progress `GetWorkoutPrsUseCase` | 9.3 | planned |
| `UpdateCompletedWorkoutUseCase` | Edit name, notes, start time and duration of a completed workout (FR-WT-039, FR-WT-036) | 9.3 | planned |
| `DeleteWorkoutUseCase` | Delete an own completed workout (FR-WT-039) | 9.3 | planned |
| `GetWorkoutHistoryUseCase` (v2) | Items with name, duration, sets and volume; filter by program/routine (FR-PR-018) | 9.3 | planned |
| `UpdateTrainingSettingsUseCase` | FR-WT-037 settings; file next to `update-profile.use-case.ts` | 9.4 | planned |
| `PurgeTombstonesUseCase` | Hard-delete rows with `deleted_at` older than 30 days; runs on login | 12.3 | planned |
| `WorkoutSnapshotAdapter` (implements `WorkoutSnapshotPort`) | Completed workout snapshot for routines' *Guardar como rutina* | 9.3 | planned |

Retired: `LogSetUseCase` (by `UpsertSetUseCase`, 9.2), `CompleteWorkoutUseCase` (by `FinishWorkoutUseCase`, 9.3), `GetTodayWorkoutUseCase` (by the routines context's next-routine use case, 8.3). `UpdateProfileUseCase` keeps `displayName`; its `routineType` input is dropped (FR-WT-016 superseded by FR-RT-004) and `weightUnit` moves to `UpdateTrainingSettingsUseCase` (9.4).

#### Orchestration

1. **`StartWorkoutUseCase.execute(input)`**

   ```ts
   interface StartWorkoutInput {
     userId: string;
     workoutId: string;              // client UUID
     mode: WorkoutStartMode;
     routineDayId: string | null;    // required for next_routine / routine
     startedAt: Date;
     updatedAt: Date;
     discardInProgress: boolean;     // "Descartar y empezar nuevo" (FR-WT-019)
     skeleton?: WorkoutSkeleton;     // client-built (dashboard next routine, offline) or built here
     now?: Date;
   }
   type StartWorkoutResult = { kind: 'started' | 'replayed'; workout: Workout };
   ```
   1. `workoutRepository.findById(workoutId)`. If it exists and belongs to `userId` → return `replayed` (idempotent). Another owner → `WorkoutOwnershipError`.
   2. `findInProgressByUser(userId)`. If one exists: `discardInProgress` → run `DiscardWorkoutUseCase` on it; otherwise throw `WorkoutInProgressError(existingWorkoutId)`.
   3. Modes `next_routine` / `routine`: `routinePlanPort.findRoutinePlan(routineDayId)`. It must exist and have `ownerId === userId` (a sibling's routine is copied first, FR-RT-006), else `InvalidRoutineDayError`. Mode `empty`: no plan, `routineDayId = null`. Mode `repeat` is only reachable through `RepeatWorkoutUseCase`, which passes the skeleton.
   4. Skeleton: `input.skeleton` when given, else `buildWorkoutSkeleton({ kind: 'plan', plan } | { kind: 'empty' }, crypto.randomUUID)`. A plan gives one exercise per routine exercise (position = `exercise_order`, rest, superset group), with `warmup_sets` warm-up rows then `target_sets` normal rows, all empty. Routine notes are not copied into session notes; they are shown read-only (FR-WT-026).
   5. Validate: `exerciseCatalogPort.findUsableByIds(exerciseIds, userId)` returns every id (else `ExerciseNotPickableError`); ≤ 30 exercises; ≤ 20 sets each.
   6. `isDeload = suggestionPort.isDeloadActive(userId, now)`. `readinessScore` stays `NULL`: the check-in happens inside the live workout and is written by progression (`POST /api/progression/readiness`, [progression readme](../progression/readme.md)). `workoutDate` = date of `startedAt` in `profiles.timezone`. `name` = the plan's routine name (`routine_days.day_name`), else `DefaultName`.
   7. `workoutRepository.createFromSkeleton(...)` in one transaction (workout + exercises + sets). A violation of `uq_workouts_one_in_progress` (race) → `WorkoutInProgressError`.

   Decision: the workout id is always client-generated; child ids are client-generated when the client builds the skeleton (the dashboard's next routine, so it works offline per [ADR-025 §6](../../decisions/025-offline-live-workout.md)) and server-generated otherwise (other routine, empty, repeat — online-only entry points). Both paths use the same pure `buildWorkoutSkeleton`.

2. **`RepeatWorkoutUseCase.execute({ userId, sourceWorkoutId, workoutId, startedAt, updatedAt, discardInProgress })`**
   1. `findAggregate(sourceWorkoutId)`. It must be owned by `userId` and `completed` (FR-SO-009: never for others' workouts).
   2. `buildWorkoutSkeleton({ kind: 'repeat', source }, crypto.randomUUID)`: same exercises, order, supersets, rest, set count and set types; no values; `routineDayId`, `programId` and `name` copied (FR-WT-018 (4)).
   3. Delegate to `StartWorkoutUseCase` with `mode: 'repeat'`.

3. **`GetLiveWorkoutStateUseCase.execute({ workoutId, viewerId, mode, onlyExerciseIds?, now? })`**
   1. `findAggregate(workoutId)` → else `WorkoutNotFoundError`. Owner only (`WorkoutOwnershipError`; the page redirects non-owners to `/workouts/[id]`). `mode = 'live'` requires `in_progress`; `mode = 'edit'` requires `completed`.
   2. `profileRepository.findById(viewerId)` → `TrainingSettings`.
   3. `exerciseCatalogPort.findByIds(distinct exerciseIds)`.
   4. If `routineDayId`: `routinePlanPort.findRoutinePlan(routineDayId)` → `routineNotes` and `targetReps` per workout exercise. Decision: routine exercises are matched to workout exercises by `exerciseId`, first unmatched in position order (handles the same exercise twice).
   5. `GetPreviousValuesUseCase` with `excludeWorkoutId = workoutId`.
   6. If `settings.progressionEnabled` and `mode = 'live'`: `suggestionPort.getSuggestions(viewerId, exerciseIds, { routineDayId, isDeload, readinessScore }, now)`, indexed by `exerciseId`. Otherwise `{}` (FR-PG-013).
   7. `recordBaselinePort.getBaselines(viewerId, exerciseIds, { excludeWorkoutId: workoutId })`.
   8. `showReadinessStep = settings.readinessEnabled && mode = 'live' && workout.readinessScore === null && no completed set` ([FR-PG-009](../../../prd/features/progression.md#fr-pg-009)).
   9. Return `LiveWorkoutInitialState`, or with `onlyExerciseIds` just `{ previous, suggestions, prBaselines }` for those exercises.

4. **`GetPreviousValuesUseCase.execute({ userId, exerciseIds, excludeWorkoutId })`** → `Record<exerciseId, PreviousSet[]>` from `findLastCompletedSetsByExercise`: for each exercise, the completed sets (any set type) of the user's most recent completed workout containing it, ordered by `set_number`. Rows pick their value with `pickPreviousSet`.

5. **`AddExercisesUseCase.execute({ userId, workoutId, exercises: [{ id, exerciseId, position, updatedAt, sets: [{ id, setNumber, setType }] }] })`**
   1. Workout owned by `userId`, `in_progress`, or `completed` (edit mode).
   2. `findUsableByIds(ids, userId)`: system, or own and not archived ([FR-EL-009](../../../prd/features/exercise-library.md#fr-el-009)). Any missing id → `ExerciseNotPickableError` (400).
   3. Limits (30 exercises, 20 sets). `rest_seconds` defaults to `NULL` (profile default).
   4. `workoutExerciseRepository.upsert` per row (idempotent), then `upsertSet` per set; positions re-densified in the same transaction.

6. **`RemoveExerciseUseCase.execute({ userId, workoutExerciseId, updatedAt })`** → owner check → `remove` (Round 9: hard delete with FK cascade; from 12.3: `deleted_at = updatedAt` on the exercise and its sets) → re-densify → `normalizeSupersets`. Already removed → `stale`. The "Se borrarán N series" confirmation is UI-only.

7. **`ReorderExercisesUseCase.execute({ userId, workoutId, orderedIds, updatedAt })`** → `position = index + 1`. Decision: unknown ids are ignored, and live ids missing from the list (added on another device) are appended in their current order. Rows with a newer stored `updatedAt` keep their position. Then `normalizeSupersets`.

8. **`ReplaceExerciseUseCase.execute({ userId, workoutExerciseId, exerciseId, clearSets, updatedAt })`** → `findUsableByIds` → if the old and new `exercise_type` differ, `clearSets` must be true (`ReplaceRequiresClearError`). `replaceExercise` updates `workout_exercises.exercise_id` and every live set's `exercise_id`; with `clearSets`, metrics are nulled and sets unchecked. Decision: clearing keeps the set rows and their types and empties the values, so the set count survives (Hevy behaviour).

9. **`SetSupersetUseCase.execute({ userId, workoutExerciseId, supersetGroup, updatedAt })`** → owner check → `upsert` with the new group → `normalizeSupersets` over the workout. Group numbers are small integers chosen by the client (`max(existing) + 1`).

10. **`UpdateWorkoutExerciseUseCase.execute({ userId, workoutExerciseId, notes?, restSeconds?, updatedAt })`** → notes ≤ 500, rest ∈ [0, 600] → LWW `upsert`.

11. **`UpsertSetUseCase.execute(input)`**

    ```ts
    interface UpsertSetInput extends SetMetrics {
      userId: string;
      id: string;                 // client UUID
      workoutExerciseId: string;
      setNumber: number;
      setType: SetType;
      completed: boolean;
      completedAt: Date | null;
      notes: string | null;
      updatedAt: Date;
    }
    ```
    1. `workoutExerciseRepository.findById(workoutExerciseId)` (live) → else `WorkoutExerciseNotFoundError`. Parent workout owned by `userId` → else `WorkoutOwnershipError`.
    2. `exerciseCatalogPort.findById(exerciseId)` (archived exercises still accept sets) → `validateSetMetrics(type, metrics, { completed })` → else `SetValidationError(errors)`.
    3. `setNumber ∈ [1, 20]`; a new set must not push the live count above 20.
    4. `completed ⇔ completedAt`. A completed set without `completedAt` gets `updatedAt`.
    5. `upsertSet` (copies `workoutId` and `exerciseId` from the parent). Stored row newer, or tombstoned → `stale`; else `created` / `updated`.

12. **`DeleteSetUseCase.execute({ userId, setId, updatedAt })`** → owner check → `removeSet` (hard delete; tombstone from 12.3) → renumber the remaining live sets `1..n` in `set_number` order, stamping `updatedAt`. Already gone → `stale`.

13. **`FinishWorkoutUseCase.execute({ userId, workoutId, completedAt, name, notes, uncheckedResolution, updatedAt, now? })`**, with `uncheckedResolution: 'complete' | 'discard'`.
    1. `findAggregate`; owner check. Already `completed` → `replayed` (idempotent; later edits go through `UpdateCompletedWorkoutUseCase`).
    2. Classify live sets. *Empty* (all metrics null) → removed silently. *Unchecked with values* → `complete` marks them completed (`completedAt` = finish time) when `validateSetMetrics` passes and removes them otherwise; `discard` removes them. Decision: unchecked sets that fail validation are removed under both options, and exercises left with no sets are removed (Hevy behaviour).
    3. Completed sets ≥ `MinCompletedEntries` → else `NoCompletedSetsError` (the UI offers *Descartar entrenamiento*).
    4. `startedAt ≤ completedAt ≤ now + ClockSkewToleranceMs` → else `InvalidWorkoutTimesError`. The > 180 min prompt is client-side.
    5. `workoutRepository.finish(workoutId, plan, userId)` in one transaction: removals, completions, `status = 'completed'`, `completedAt`, `name`, `notes`, `updatedAt`.

14. **`UpdateCompletedWorkoutUseCase.execute({ userId, workoutId, name?, notes?, startedAt?, completedAt?, updatedAt })`** → owner, `completed` → name 1–60, `startedAt ≤ completedAt ≤ now + skew` → recompute `workoutDate` → LWW `update`. Records and stats re-derive on read ([ADR-020 §4](../../decisions/020-personal-records.md)). Set and exercise edits made in edit mode arrive first, as the normal upsert commands.

15. **`GetWorkoutSummaryUseCase.execute({ workoutId, viewerId })`** → `{ workout, durationSeconds, volumeKg, completedSets, setsPerMuscle (top 5), previousComparison: { workoutId, volumeDeltaPct } | null }`.
    - Volume: Σ `max(0, weight) × reps` over completed sets (bodyweight volume per FR-BM-007 is a stats concern).
    - Sets per muscle: working sets (`set_type ≠ warmup`), primary = 1, secondary = 0.5, same rule as [FR-PR-015](../../../prd/features/progress.md#fr-pr-015).
    - Comparison: `findPreviousCompletedByRoutineDay(userId, routineDayId, before = completedAt)`; `null` for empty workouts.

16. **`DiscardWorkoutUseCase.execute({ userId, workoutId })`** → owner, `in_progress` (else `WorkoutNotInProgressError`) → `delete` (FK cascade). Already gone → no-op. **`DeleteWorkoutUseCase`** is the same for `completed` workouts.

17. **`UpdateTrainingSettingsUseCase.execute({ userId, weightUnit?, defaultRestSeconds?, barWeight?, availablePlates?, rpeEnabled?, progressionEnabled?, readinessEnabled? })`**. Bar and plates are given in the display unit of the resulting `weightUnit`.
    - Rest ∈ [0, 600]; bar ∈ [0, 50] kg; plates: 1–12 distinct values in (0, 50] kg, stored sorted desc as JSON. lb → kg conversion keeps full precision (`× 0.45359237`).
    - Decision: when `weightUnit` changes and bar/plates still equal the old unit's `TrainingSettingsDefaults`, they switch to the new unit's defaults (Hevy keeps unit-specific plate sets).
    - Persists through `ProfileRepository.update` (patch widened). Triggered from `/settings` (PRG), like `UpdateProfileUseCase`.

---

### Infrastructure (Phase 2)

Per [ADR-007](../../decisions/007-repository-pattern.md) and [ADR-011](../../decisions/011-implements-not-extends.md): abstract classes in `domain/`, plus `SqliteXxxRepository` and `SupabaseXxxRepository` that `implements` them. `find*` returns `T | undefined`.

#### Abstract classes (contracts)

```ts
// src/lib/contexts/workout-tracking/domain/workout.repository.ts (Phase 2 additions)
export type WorkoutUpdate = Partial<
  Pick<Workout, 'status' | 'completedAt' | 'startedAt' | 'workoutDate' | 'name' | 'notes'>
> & { updatedAt: Date };                                     // LWW key, required in Phase 2

export interface FinishPlan {
  completeSetIds: string[];       // unchecked → completed at completedAt
  removeSetIds: string[];         // empty, discarded or invalid
  removeWorkoutExerciseIds: string[];
  completedAt: Date;
  name: string;
  notes: string | null;
  updatedAt: Date;
}

export abstract class WorkoutRepository {
  // Phase 1 (kept): findById, findInProgressByUser, delete, getHistoryCountByUser, ...
  abstract createIfAbsent(input: NewWorkout & { id: string }): Promise<UpsertResult<Workout>>;
  abstract createFromSkeleton(
    workout: NewWorkout & { id: string },
    skeleton: WorkoutSkeleton,
  ): Promise<WorkoutAggregate>;                              // one transaction
  abstract update(id: string, patch: WorkoutUpdate, currentUserId: string): Promise<UpsertResult<Workout>>;
  abstract findAggregate(id: string): Promise<WorkoutAggregate | undefined>; // read-all, live rows only
  abstract finish(id: string, plan: FinishPlan, currentUserId: string): Promise<Workout>;
  abstract findLastCompletedSetsByExercise(
    userId: string,
    exerciseIds: string[],
    options: { excludeWorkoutId: string | null },
  ): Promise<Map<string, PreviousSet[]>>;
  abstract findPreviousCompletedByRoutineDay(
    userId: string,
    routineDayId: string,
    before: Date,
  ): Promise<WorkoutAggregate | undefined>;
  abstract getHistoryByUser(
    userId: string,
    limit: number,
    offset: number,
    filter?: { programId?: string; routineDayId?: string },
  ): Promise<WorkoutHistoryItem[]>; // v2 item: name, startedAt, completedAt, setCount, totalVolume
}

// src/lib/contexts/workout-tracking/domain/workout-exercise.repository.ts (new, story 7.1)
export abstract class WorkoutExerciseRepository {
  abstract findById(id: string): Promise<WorkoutExercise | undefined>;           // live only
  abstract listByWorkout(workoutId: string): Promise<WorkoutExerciseWithSets[]>; // by position
  abstract upsert(
    input: NewWorkoutExercise & { id: string; updatedAt: Date },
    currentUserId: string,
  ): Promise<UpsertResult<WorkoutExercise>>;
  /** Removes the exercise and its sets, then re-densifies positions. */
  abstract remove(id: string, removedAt: Date, currentUserId: string): Promise<UpsertOutcome>;
  abstract reorder(workoutId: string, orderedIds: string[], updatedAt: Date, currentUserId: string): Promise<void>;
  abstract replaceExercise(
    id: string,
    exerciseId: string,
    options: { clearSets: boolean; updatedAt: Date },
    currentUserId: string,
  ): Promise<WorkoutExerciseWithSets>;
  abstract findSetById(id: string): Promise<WorkoutSet | undefined>;
  /** Copies workoutId and exerciseId from the parent; callers never pass them. */
  abstract upsertSet(
    input: Omit<NewWorkoutEntry, 'workoutId' | 'exerciseId'> & {
      id: string; workoutExerciseId: string; updatedAt: Date;
    },
    currentUserId: string,
  ): Promise<UpsertResult<WorkoutSet>>;
  /** Removes the set, then renumbers the remaining live sets. */
  abstract removeSet(id: string, removedAt: Date, currentUserId: string): Promise<UpsertOutcome>;
  abstract purgeTombstones(before: Date): Promise<number>;  // story 12.3
}
```

Consumed port contracts (`ExerciseCatalogPort`, `RoutinePlanPort`, `SuggestionPort`, `RecordBaselinePort`) are declared and implemented by their providers; see the [Ports](#ports-phase-2) table for the methods this context calls. The only port this context declares is the one it **provides**:

```ts
// src/lib/contexts/workout-tracking/domain/ports/workout-snapshot.port.ts — PROVIDED to routines (9.3)
// Shape agreed with the routines readme (FR-RT-018: Guardar como rutina).
export interface WorkoutSnapshot {
  workoutId: string;
  userId: string;
  status: 'in_progress' | 'completed';
  name: string;
  notes: string | null;
  exercises: Array<{
    exerciseId: string;
    position: number;
    supersetGroup: number | null;
    restSeconds: number | null;
    notes: string | null;
    sets: Array<{ setType: SetType; reps: number | null; durationSeconds: number | null; completed: boolean }>;
  }>;
}
export abstract class WorkoutSnapshotPort {
  /** Live rows only. Returns undefined when the workout is missing or not completed. Read-all (ADR-004). */
  abstract findCompletedSnapshot(workoutId: string): Promise<WorkoutSnapshot | undefined>;
}
// Implemented by application/workout-snapshot.adapter.ts (wraps WorkoutRepository.findAggregate);
// exported as `workoutSnapshotPort` from workout-tracking.composition.ts.
```

#### SQLite notes

- `createFromSkeleton`, `finish`, `remove`, `removeSet`, `reorder` and `replaceExercise` run inside `db.transaction(...)`.
- LWW upsert: `INSERT … ON CONFLICT(id) DO UPDATE SET … WHERE excluded.updated_at >= <table>.updated_at AND <table>.deleted_at IS NULL`. No row changed on an existing id → `stale`.
- Ownership is checked by joining `workouts.user_id` before writing (SQLite has no RLS).
- A violation of `uq_workouts_one_in_progress` maps to `WorkoutInProgressError` (same pattern as Phase 1 `isUniqueConstraintError`).

#### Supabase notes

- Same contracts. `createFromSkeleton` and `finish` call RPCs (`start_workout_v2`, `finish_workout`, `SECURITY INVOKER`) so they stay atomic. LWW upserts call `upsert_workout_exercise` / `upsert_workout_set`, which apply the `updated_at` guard. RLS on `workout_exercises` follows `workout_entries` (migration 004).
- Decision: the four RPCs ship in `004_workout_model_v2.sql` (story 7.1), because PostgREST has no conditional upsert. (Simplest atomic option.)

#### Wiring (composition)

```ts
// src/lib/contexts/workout-tracking/workout-tracking.composition.ts (Phase 2 additions)
export const workoutExerciseRepository: WorkoutExerciseRepository =
  buildWorkoutExerciseRepository(backend); // sqlite | supabase

// Provided ports: singletons exported by the providers' composition roots (contexts/readme.md → Cross-context ports)
import { exerciseCatalogPort as exerciseCatalog } from '@/lib/contexts/exercise-library/exercise-library.composition';
import { routinePlanPort as routinePlan } from '@/lib/contexts/routines/routines.composition';
// Until 10.2 / 10.1 land, null-object adapters from ./infrastructure/null-adapters/:
const suggestions: SuggestionPort = new NoSuggestionAdapter();             // → progression `suggestionPort`, 10.2
const recordBaselines: RecordBaselinePort = new NoRecordBaselineAdapter(); // → progress `recordBaselinePort`, 10.1

export const discardWorkoutUseCase = new DiscardWorkoutUseCase(workoutRepository);
export const getPreviousValuesUseCase = new GetPreviousValuesUseCase(workoutRepository);
export const startWorkoutUseCase = new StartWorkoutUseCase(
  workoutRepository, profileRepository, routinePlan, exerciseCatalog, suggestions, discardWorkoutUseCase,
);
export const getLiveWorkoutStateUseCase = new GetLiveWorkoutStateUseCase(
  workoutRepository, profileRepository, exerciseCatalog, routinePlan,
  getPreviousValuesUseCase, suggestions, recordBaselines,
);
export const upsertSetUseCase = new UpsertSetUseCase(workoutExerciseRepository, workoutRepository, exerciseCatalog);
export const workoutSnapshotPort: WorkoutSnapshotPort = new WorkoutSnapshotAdapter(workoutRepository); // → routines
// ... one export per use case in the table above
```

---

### UI (Phase 2)

#### Components

Specs: [components.md → Live Workout](../../components.md#live-workout), [Gym Tools](../../components.md#gym-tools), [Navigation v2](../../components.md#navigation-v2). `ExerciseCard`, `src/lib/client/auto-save.ts` and `RestTimer` are retired (stories 9.1 / 9.2).

#### Island: `LiveWorkout`

`src/components/live-workout/live-workout.tsx`, mounted by `src/pages/workout/[id].astro` with `client:load` and the `LiveWorkoutInitialState` JSON prop ([ADR-015](../../decisions/015-live-workout-react-island.md)). It may import pure domain modules (`set-metrics`, `set-label`, `superset`, `previous-set`, `workout-skeleton`, `plate-calculator`, `warmup-generator`, and progress `personal-records`), never repositories.

| File (`src/components/live-workout/`) | Role |
|---|---|
| `live-workout.reducer.ts` | Pure `liveWorkoutReducer(state, action)`. No `Date.now()`: every action carries `at` (epoch ms) |
| `live-workout.commands.ts` | Pure `toCommands(prev, action, next): OutboxCommand[]` |
| `live-workout.selectors.ts` | `selectTotals(state, now)` → `{ elapsedSeconds, volumeKg, completedSets }` (FR-WT-020); `selectSetLabels` |
| `use-live-workout.ts` | `dispatch` = reducer + `toCommands` + `outbox.enqueue` + snapshot save. Coalesces `upsert-set` for the same set id within 500 ms |
| `sync/outbox.ts` | `OutboxStore` interface; `MemoryOutboxStore` (9.1), `IndexedDbOutboxStore` (12.3) |
| `sync/sync-worker.ts` | Drains the outbox to the API |
| `use-rest-timer.ts` | Display and side effects of the rest timer |

**State shape** (mirrors `workout → workout_exercises[] → sets[]`):

```ts
export interface LiveWorkoutState {
  mode: 'live' | 'edit';
  workout: LiveWorkoutInitialState['workout'];
  exercises: LiveExercise[];                           // ordered by position
  previous: Record<string, PreviousSet[]>;             // by exerciseId
  suggestions: Record<string, ExerciseSuggestion>;     // by exerciseId (progression type)
  prBaselines: Record<string, RecordBaseline>;         // by exerciseId; updated locally on PRs
  settings: TrainingSettings;
  restTimer: RestTimerState | null;
  sync: SyncStatus;
  pendingEditCommands: OutboxCommand[];                // edit mode only: held until "Guardar"
  showReadinessStep: boolean;                          // from the initial state; cleared by readiness/*
}

export interface LiveExercise {
  id: string; exerciseId: string; exercise: CatalogExercise; position: number;
  supersetGroup: number | null; restSeconds: number | null; notes: string | null;
  routineNotes: string | null; targetReps: { min: number; max: number } | null;
  updatedAt: number;
  sets: LiveSet[];                                     // ordered by setNumber
}

export interface LiveSet extends SetMetrics {
  id: string; setNumber: number; setType: SetType;
  completed: boolean; completedAt: number | null; updatedAt: number;
  prefill: Partial<SetMetrics> | null;  // muted values, not persisted until edited or checked (FR-WT-030)
  prs: RecordType[];                    // live badges (FR-PR-009)
  invalidFields: SetMetricField[];      // shake + highlight (FR-WT-033)
}

export interface RestTimerState {
  workoutExerciseId: string;
  durationSeconds: number;
  endsAt: number;                       // absolute epoch ms (FR-WT-034)
}

export interface SyncStatus { online: boolean; pending: number; failed: number; lastSyncedAt: number | null }
```

Prefill (FR-WT-030) is computed on `state/initialized` and `exercise/added`: suggestion (when `progressionEnabled`) → `pickPreviousSet` → empty with the `targetReps` placeholder. Checking a prefilled row turns the prefill into real values.

**Actions** (`type` + payload; every action also carries `at: number`):

| Action | Payload | Effect |
|---|---|---|
| `state/initialized` | `initial: LiveWorkoutInitialState` | Build state, compute prefill |
| `state/restored` | `snapshot: LiveWorkoutState` | Reload from IndexedDB `sessions` (12.3) |
| `workout/renamed` | `name` | Header name (FR-WT-020) |
| `workout/notes-changed` | `notes` | |
| `workout/times-edited` | `startedAt`, `completedAt` | Edit mode only (FR-WT-039) |
| `exercise/added` | `exercises: { id, exercise, setIds: string[] }[]` | Append at the end, one empty set each (FR-WT-021) |
| `exercise/context-loaded` | `previous`, `suggestions`, `prBaselines` | Merge the `exercise-context` slice for added exercises |
| `readiness/submitted` | `score`, `suggestions: ExerciseSuggestion[]` | From `ReadinessStep` after `POST /api/progression/readiness`; sets `workout.readinessScore`, replaces suggestions, recomputes prefill of untouched rows ([FR-PG-010](../../../prd/features/progression.md#fr-pg-010)) |
| `readiness/skipped` | — | Hides the step for this workout |
| `exercise/removed` | `workoutExerciseId` | Re-densify, `normalizeSupersets` (FR-WT-022) |
| `exercise/moved` | `workoutExerciseId`, `toIndex` | Drag handle or *Subir/Bajar* (FR-WT-023) |
| `exercise/replaced` | `workoutExerciseId`, `exercise`, `clearSets` | FR-WT-024 |
| `exercise/superset-linked` | `workoutExerciseId`, `withIds: string[]` | Same new group; members made contiguous (FR-WT-025) |
| `exercise/superset-unlinked` | `workoutExerciseId` | |
| `exercise/notes-changed` | `workoutExerciseId`, `notes` | FR-WT-026 |
| `exercise/rest-changed` | `workoutExerciseId`, `restSeconds` | Also dispatched by editing the timer bar (FR-WT-034) |
| `exercise/warmups-added` | `workoutExerciseId`, `sets: { id, weight, reps }[]` | Insert before the first working set, renumber (FR-WT-041) |
| `set/added` | `workoutExerciseId`, `setId` | Copy the last set's values and type (FR-WT-032) |
| `set/changed` | `setId`, `patch: Partial<SetMetrics>` | Clears `prefill` for the touched fields |
| `set/type-changed` | `setId`, `setType` | FR-WT-028 |
| `set/previous-copied` | `setId` | Copy *Anterior* values (FR-WT-029) |
| `set/checked` | `setId` | Validate; on success `completed`, `completedAt = at`, PR detection, start timer (FR-WT-033) |
| `set/unchecked` | `setId` | Revert `completed`, clear `completedAt` and its badges |
| `set/removed` | `setId` | Renumber (FR-WT-032) |
| `timer/adjusted` | `deltaSeconds` (±15) | Moves `endsAt` |
| `timer/skipped` | — | `restTimer = null` |
| `timer/finished` | — | `restTimer = null` (fired by `use-rest-timer`) |
| `workout/finished` | `completedAt`, `uncheckedResolution` | Live: `finish-workout`. Edit: flush `pendingEditCommands`, then `finish-workout` |
| `workout/discarded` | — | FR-WT-038 |
| `edit/cancelled` | — | Drop `pendingEditCommands` |
| `sync/status-changed` | `Partial<SyncStatus>` | From the sync worker |

Timer rules (pure, in the reducer): on `set/checked`, rest = `exercise.restSeconds ?? settings.defaultRestSeconds`; `0` → no timer. In a superset the timer starts only when the checked set belongs to the **last** exercise (by position) of its group (FR-WT-025). A new check replaces a running timer.

PR detection uses `detectPrs(prBaselines[exerciseId], set)` from `src/lib/contexts/progress/domain/personal-records.ts` ([ADR-020 §4](../../decisions/020-personal-records.md)). Warm-ups never count, `hasHistory = false` gives no badges, and the baseline is updated locally so later sets compare against earlier sets of the same workout.

**Outbox commands** (exact names from [ADR-025 §4](../../decisions/025-offline-live-workout.md)). Entry: `{ seq, command, payload, createdAt, attempts }`. Every payload carries `workoutId` and `updatedAt`.

| Command | Emitted by | Payload (besides `workoutId`, `updatedAt`) | Endpoint |
|---|---|---|---|
| `start-workout` | `NextWorkoutCard` (outside the reducer) | `id`, `mode`, `routineDayId`, `sourceWorkoutId`, `startedAt`, `discardInProgress`, `skeleton?` | `PUT /api/workouts/[id]` |
| `add-exercise` | `exercise/added` (one per exercise) | `id`, `exerciseId`, `position`, `sets: { id, setNumber, setType }[]` | `PUT /api/workout-exercises/[id]` |
| `update-exercise` | `exercise/replaced`, `exercise/superset-*`, `exercise/notes-changed`, `exercise/rest-changed`, and superset normalization side effects | `id`, `change: { kind: 'details', notes?, restSeconds? } \| { kind: 'replace', exerciseId, clearSets } \| { kind: 'superset', supersetGroup }` | `PATCH /api/workout-exercises/[id]` |
| `remove-exercise` | `exercise/removed` | `id` | `DELETE /api/workout-exercises/[id]` |
| `reorder-exercises` | `exercise/moved`, `exercise/superset-linked` (when it moves rows) | `orderedIds` | `PUT /api/workouts/[id]/exercise-order` |
| `upsert-set` | `set/added`, `set/changed`, `set/type-changed`, `set/previous-copied`, `set/checked`, `set/unchecked`, `exercise/warmups-added` (one per new or renumbered set) | full set row (storage units) | `PUT /api/workout-sets/[id]` |
| `delete-set` | `set/removed` | `id` | `DELETE /api/workout-sets/[id]` |
| `finish-workout` | `workout/finished` | `mode`, `completedAt`, `startedAt` (edit), `name`, `notes`, `uncheckedResolution` | `POST /api/workouts/[id]/finish` |
| `discard-workout` | `workout/discarded` (after removing this workout's pending commands) | — | `DELETE /api/workouts/[id]` |

The readiness check-in is not an outbox command: `ReadinessStep` (progression, [components.md → Progression](../../components.md#progression)) calls the progression endpoint directly, and progression writes `readiness_checkins` and `workouts.readiness_score`.

`workout/renamed` and `workout/notes-changed` emit no command: the header name and notes travel with `finish-workout` and live in the snapshot meanwhile. Timer, sync and `state/*` actions emit nothing.

Decision: in edit mode the commands are held in `pendingEditCommands` and enqueued only on *Guardar*, followed by `finish-workout` (`mode: 'edit'`). *Cancelar* drops them (Hevy edit-workout behaviour: changes apply on save).

**Sync worker contract** (`sync/sync-worker.ts`):

```ts
export interface OutboxStore {
  enqueue(command: OutboxCommandName, payload: OutboxPayload): Promise<number>; // returns seq
  peek(): Promise<OutboxEntry | undefined>;                                     // lowest seq
  ack(seq: number): Promise<void>;
  moveToFailed(seq: number, status: number, body: unknown): Promise<void>;      // store outbox_failed
  bumpAttempts(seq: number): Promise<void>;
  removeByWorkout(workoutId: string): Promise<void>;
  counts(): Promise<{ pending: number; failed: number }>;
}

export function createSyncWorker(deps: {
  outbox: OutboxStore;
  send: (entry: OutboxEntry) => Promise<Response>;   // maps command → fetch (table above)
  onStatus: (status: Partial<SyncStatus>) => void;
}): { start(): void; stop(): void; kick(): void };
```

- Drains in `seq` order, **one at a time**. Triggers: `kick()` after every enqueue, the `online` event, every 15 s while online, and `visibilitychange` → visible.
- `2xx` (including `outcome: 'stale'`) → `ack`. `401` → pause and show "Inicia sesión para sincronizar" (not failed). Other `4xx` → `moveToFailed` plus the banner "N cambios no se pudieron guardar". `5xx` or network error → `bumpAttempts`, retry after `min(2^attempts s, 300 s)`.
- Never blocks input (NFR-WT-P2-02). Round 9: `MemoryOutboxStore`, online only. Round 12: `IndexedDbOutboxStore` (database `gymup`, stores `outbox`, `outbox_failed`, `sessions`); `use-live-workout` saves the state to `sessions[workoutId]` on every action (NFR-WT-P2-03).
- Decision: no outbox compaction beyond the 500 ms `upsert-set` coalescing and the discard purge; replays are idempotent. (Simplest.)

**`use-rest-timer`** (`use-rest-timer.ts`, replaces `rest-timer.tsx`, story 9.2):

```ts
export function useRestTimer(timer: RestTimerState | null, onFinish: () => void): {
  remainingSeconds: number;   // ceil((endsAt − Date.now()) / 1000), never negative
  isRunning: boolean;
};
```

- Recomputes from the absolute `endsAt` every 250 ms and on `visibilitychange`, so it stays correct after a screen lock or tab sleep (FR-WT-034).
- At 0, once per timer: `navigator.vibrate([200, 100, 200])` when supported, a short sound, a Web Notification when permission is granted, then `onFinish()` → `timer/finished`.
- Notification permission is requested once, at the first timer start (flag in `localStorage`, wrapped in try/catch).

#### Pages

| Route | Rendering | Content |
|---|---|---|
| `/workout/[id]` | SSR | Owner + `in_progress` → `LiveWorkout` (`mode: 'live'`). Owner + `completed` → `WorkoutSummary` v2. `?mode=edit` (owner, completed) → `LiveWorkout` (`mode: 'edit'`). Non-owner → redirect to `/workouts/[id]` |
| `/dashboard` | SSR | `NextWorkoutCard` builds the next-routine skeleton client-side (offline-capable); `InProgressBanner` |
| `/history` | SSR | History v2 (FR-PR-018) |
| `/settings` | SSR, PRG | *Entrenamiento* section → `UpdateTrainingSettingsUseCase` (FR-WT-037) |
| `/profile/tools` | SSR + island | `OneRmCalculator` (FR-WT-042) |

Decision: the summary stays at `/workout/[id]` once completed (Phase 1 behaviour) and edit mode is `?mode=edit` on the same route; `/workouts/[id]` remains the read-only social detail (FR-SO-003). Decision: the 1RM calculator lives at `/profile/tools` (Profile → *Herramientas*).

#### API endpoints

All JSON. IDs in paths are client UUIDs. Every write is an idempotent upsert or delete ([ADR-025 §3](../../decisions/025-offline-live-workout.md)); replays return `200`. Status codes: `400` malformed payload or invalid metrics, `401` no session, `404` unknown parent, `403` ownership violation (same as Phase 1 `WorkoutOwnershipError`, [ADR-025 → Consequences](../../decisions/025-offline-live-workout.md)), `422` domain rule (`workout_in_progress`, `no_completed_sets`, `limit_exceeded`, `replace_requires_clear`). Error body: `{ error: <code>, details? }`.

| Method | Path | Use case | Notes |
|---|---|---|---|
| PUT | `/api/workouts/[id]` | `StartWorkoutUseCase`; `RepeatWorkoutUseCase` when `mode: 'repeat'` (+ `sourceWorkoutId`) | `start-workout`. `201` started, `200` replayed, `422 { error: 'workout_in_progress', details: { workoutId } }` |
| GET | `/api/workouts/active` | `GetActiveWorkoutUseCase` | Banner refresh; `204` when none |
| GET | `/api/workouts/[id]/live-state` | `GetLiveWorkoutStateUseCase` | Same JSON as the island prop; `?mode=edit` |
| GET | `/api/workouts/[id]/exercise-context?exerciseIds=a,b` | `GetLiveWorkoutStateUseCase` (`onlyExerciseIds`) | `{ previous, suggestions, prBaselines }` for exercises added mid-session. Offline: skipped, *Anterior* shows "—" |
| PUT | `/api/workout-exercises/[id]` | `AddExercisesUseCase` | `add-exercise` |
| PATCH | `/api/workout-exercises/[id]` | `UpdateWorkoutExerciseUseCase` / `ReplaceExerciseUseCase` / `SetSupersetUseCase` | `update-exercise`, dispatched by `change.kind` |
| DELETE | `/api/workout-exercises/[id]?updatedAt=` | `RemoveExerciseUseCase` | `remove-exercise`. `updatedAt` in the query (DELETE bodies are unreliable) |
| PUT | `/api/workouts/[id]/exercise-order` | `ReorderExercisesUseCase` | `reorder-exercises` |
| PUT | `/api/workout-sets/[id]` | `UpsertSetUseCase` | `upsert-set`. Body in storage units (kg, s, m). Returns `{ outcome, set }` |
| DELETE | `/api/workout-sets/[id]?updatedAt=` | `DeleteSetUseCase` | `delete-set` |
| POST | `/api/workouts/[id]/finish` | `FinishWorkoutUseCase` (`mode: 'live'`) / `UpdateCompletedWorkoutUseCase` (`mode: 'edit'`) | `finish-workout`. `422 no_completed_sets` |
| PATCH | `/api/workouts/[id]` | `UpdateCompletedWorkoutUseCase` | Summary name/notes edit (FR-WT-036), online |
| DELETE | `/api/workouts/[id]` | `DiscardWorkoutUseCase` (in progress) / `DeleteWorkoutUseCase` (completed) | `discard-workout`; also *Eliminar* on the detail page |

Retired: `POST /api/workouts` (form start, 9.1), `POST /api/workout-entries` (9.2), `POST /api/workouts/[id]/complete` (9.3). Weight conversion moves from the endpoint (Phase 1 `weightUnit` field) to the island inputs.

---

### Testing (Phase 2)

Per [ADR-009](../../decisions/009-object-mothers.md): real SQLite (`tests/workout-tracking/test-db.ts`), Object Mothers, no mocks. Pure modules get exhaustive table-driven tests.

| Test file (`tests/workout-tracking/`) | What it proves | Story |
|---|---|---|
| `set-metrics.test.ts` | Table: 7 exercise types × required / forbidden / range cases, completed vs draft | 7.1 |
| `set-label.test.ts` | `W` / `D` / `F` and normal ordinals with mixed types | 7.1 |
| `sqlite-workout-exercise.repository.test.ts` | Upsert idempotency, LWW `stale`, `exerciseId` copied from parent, dense positions and set numbers, cascade | 7.1 |
| `phase-1-fixture.regression.test.ts` | Loads `tests/fixtures/phase-1.db` and runs the migrations: history names, set counts, volumes and progress numbers unchanged; one `workout_exercises` row per (workout, exercise) in Phase 1 order | 7.1 (re-run by every migration story) |
| `workout-skeleton.test.ts`, `superset.test.ts` | Plan / repeat / empty skeletons; warm-up rows before working rows; contiguity rules | 9.1 |
| `live-workout.reducer.test.ts` | Table: `(state mother, action) → expected state + expected commands`, at least one row per action; superset timer rule; prefill priority; PR badges; edit-mode holding | 9.1, 9.2 |
| `sync-worker.test.ts` | Ordering, 2xx / 4xx / 5xx / 401 handling, backoff, with an in-memory fake transport (a fake, not a mock) | 9.1, 12.3 |
| `start-workout-v2.use-case.test.ts` | 4 modes, replay, in-progress conflict, `discardInProgress`, foreign routine, unusable exercise, limits | 9.1 |
| `upsert-set.use-case.test.ts`, `delete-set.use-case.test.ts` | Create / update / stale, tombstone never resurrected (12.3), `WorkoutOwnershipError`, renumbering | 9.2 |
| `finish-workout.use-case.test.ts` | `complete` vs `discard`, empty sets removed, invalid unchecked sets removed, `NoCompletedSetsError`, replay | 9.3 |
| `update-completed-workout.use-case.test.ts` | Time validation, `workoutDate` recomputed in the user timezone | 9.3 |
| `use-rest-timer.test.ts` | Remaining time from `endsAt` with an injected clock | 9.2 |
| `plate-calculator.test.ts`, `warmup-generator.test.ts` | Greedy plates, unloadable weights, below-bar warm-ups skipped, lbs plates | 9.5 |
| `tests/supabase/rls-workout-exercises.integration.test.ts` | A non-owner cannot insert, update or delete `workout_exercises` or sets of another user's workout | 7.1 |

Decision: Object Mothers live in `tests/workout-tracking/mothers/` (`workout.mother.ts`, `workout-exercise.mother.ts`, `workout-set.mother.ts`, `live-workout-state.mother.ts`), because no mothers exist in `tests/` yet. (Simplest location, next to the tests that use them.)

```ts
// tests/workout-tracking/live-workout.reducer.test.ts
import { describe, it, expect } from 'vitest';
import { liveWorkoutReducer } from '@/components/live-workout/live-workout.reducer';
import { toCommands } from '@/components/live-workout/live-workout.commands';
import { LiveWorkoutStateMother } from './mothers/live-workout-state.mother';

const cases = [
  {
    name: 'checking a valid set completes it and starts the exercise rest timer',
    state: () => LiveWorkoutStateMother.withOneWeightRepsExercise({ restSeconds: 120 }),
    action: (s) => ({ type: 'set/checked', setId: s.exercises[0].sets[0].id, at: 1_000 }),
    check: (next) => {
      expect(next.exercises[0].sets[0].completed).toBe(true);
      expect(next.restTimer?.endsAt).toBe(1_000 + 120_000);
    },
    commands: ['upsert-set'],
  },
  {
    name: 'checking a set of a non-last superset member starts no timer',
    state: () => LiveWorkoutStateMother.withSuperset(),
    action: (s) => ({ type: 'set/checked', setId: s.exercises[0].sets[0].id, at: 1_000 }),
    check: (next) => expect(next.restTimer).toBeNull(),
    commands: ['upsert-set'],
  },
];

describe('liveWorkoutReducer', () => {
  it.each(cases)('$name', ({ state, action, check, commands }) => {
    const prev = state();
    const a = action(prev);
    const next = liveWorkoutReducer(prev, a);
    check(next);
    expect(toCommands(prev, a, next).map((c) => c.command)).toEqual(commands);
  });
});
```

### Flows (Phase 2)

- [live-workout.flow.md](./flows/live-workout.flow.md) — start → log → supersets → timer → finish
- [finish-workout.flow.md](./flows/finish-workout.flow.md) — finish dialog, server finish, summary v2
- [edit-workout.flow.md](./flows/edit-workout.flow.md) — edit, delete and repeat a completed workout
