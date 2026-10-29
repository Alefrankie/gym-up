// tests/workout-tracking/get-today-workout.use-case.test.ts
//
// AC-2.1-01..05 + AC-2.1-06 (use case), AC-2.1-07 (invalid ?day),
// AC-2.1-10 (weekend card).
//
// Covers every state of the GetTodayWorkoutUseCase result discriminated
// union: no_routine, rest_day, workout_day (with not_started /
// in_progress / completed status).
//
// Uses real SqliteRoutineRepository + SqliteWorkoutRepository against an
// in-memory DB (same pattern as cascade.test.ts / smoke.test.ts) so the
// integration is end-to-end through the production type signatures.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  GetTodayWorkoutUseCase,
  type GetTodayWorkoutInput,
} from '@/lib/contexts/workout-tracking/application/get-today-workout.use-case';
import { SqliteRoutineRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import {
  exercises,
  profiles,
  routineDays,
  routineExercises,
  routines,
  workouts,
} from '@db/schema';

let handle: TestDbHandle;
let useCase: GetTodayWorkoutUseCase;
let userId: string;
let routineId: string;
const dayIdByNumber = new Map<number, string>();
let exerciseId: string;

// Reference dates — mid-day UTC so weekday math is stable.
const MONDAY = new Date('2026-07-27T12:00:00Z'); // Mon
const WEDNESDAY = new Date('2026-07-29T12:00:00Z'); // Wed
const FRIDAY = new Date('2026-07-31T12:00:00Z'); // Fri
const SATURDAY = new Date('2026-08-01T12:00:00Z'); // Sat
const SUNDAY = new Date('2026-08-02T12:00:00Z'); // Sun

const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

beforeAll(async () => {
  handle = createTestDb();
  const routineRepo = new SqliteRoutineRepository(handle.db);
  const workoutRepo = new SqliteWorkoutRepository(handle.db);
  useCase = new GetTodayWorkoutUseCase(routineRepo, workoutRepo);

  const [p] = await handle.db
    .insert(profiles)
    .values({
      email: 'usecase@example.com',
      passwordHash: 'hashed_password',
      displayName: 'UseCase Tester',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = p.id;

  const [r] = await handle.db
    .insert(routines)
    .values({ name: 'Test Routine', type: 'hombre' })
    .returning();
  routineId = r.id;

  for (let dayNumber = 1; dayNumber <= 5; dayNumber++) {
    const [d] = await handle.db
      .insert(routineDays)
      .values({
        routineId,
        dayNumber,
        dayName: DAY_NAMES[dayNumber]!,
        focus: `Day ${dayNumber} focus`,
      })
      .returning();
    dayIdByNumber.set(dayNumber, d.id);
  }

  // One exercise linked to day 1 only — verifies that day 3 returns
  // an empty exercise list (data integrity edge case).
  const [e] = await handle.db
    .insert(exercises)
    .values({ name: 'Bench Press', muscleGroup: 'chest' })
    .returning();
  exerciseId = e.id;
  await handle.db.insert(routineExercises).values({
    routineDayId: dayIdByNumber.get(1)!,
    exerciseId,
    targetSets: 4,
    targetReps: 10,
    exerciseOrder: 1,
  });
});

afterAll(() => handle.close());

function input(overrides: Partial<GetTodayWorkoutInput> = {}): GetTodayWorkoutInput {
  return {
    userId,
    routineType: 'hombre',
    weightUnit: 'kg',
    ...overrides,
  };
}

describe('GetTodayWorkoutUseCase', () => {
  describe('no_routine state', () => {
    it('returns no_routine when routineType is null', async () => {
      const result = await useCase.execute(input({ routineType: null }));
      expect(result.kind).toBe('no_routine');
    });
  });

  describe('workout_day state', () => {
    it('returns workout_day for Monday with exercises and status=not_started', async () => {
      const result = await useCase.execute(input({ now: MONDAY }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(1);
      expect(result.routineDay.id).toBe(dayIdByNumber.get(1));
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0]?.exercise.name).toBe('Bench Press');
      expect(result.exercises[0]?.targetSets).toBe(4);
      expect(result.exercises[0]?.targetReps).toBe(10);
      expect(result.workoutStatus).toBe('not_started');
      expect(result.existingWorkoutId).toBeNull();
      expect(result.weightUnit).toBe('kg');
    });

    it('returns workout_day for Wednesday with no exercises (empty routine day)', async () => {
      const result = await useCase.execute(input({ now: WEDNESDAY }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(3);
      expect(result.routineDay.id).toBe(dayIdByNumber.get(3));
      expect(result.exercises).toHaveLength(0);
    });

    it('uses dayOverride when provided on a weekday', async () => {
      const result = await useCase.execute(input({ now: MONDAY, dayOverride: 3 }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(3);
      expect(result.routineDay.id).toBe(dayIdByNumber.get(3));
    });

    it('preserves weightUnit from input on workout_day', async () => {
      const result = await useCase.execute(
        input({ now: MONDAY, weightUnit: 'lbs' }),
      );
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.weightUnit).toBe('lbs');
    });
  });

  describe('invalid dayOverride fallback (AC-2.1-07)', () => {
    it('falls back to day 1 when dayOverride=99 on a weekday', async () => {
      const result = await useCase.execute(input({ now: MONDAY, dayOverride: 99 }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(1);
    });

    it('falls back to day 1 when dayOverride=0 on a weekday', async () => {
      const result = await useCase.execute(input({ now: WEDNESDAY, dayOverride: 0 }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(1);
    });

    it('falls back to day 1 when dayOverride=-1 on a weekday', async () => {
      const result = await useCase.execute(input({ now: FRIDAY, dayOverride: -1 }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(1);
    });

    it('falls back to day 1 when dayOverride is invalid on a weekend (returns workout_day, not rest_day)', async () => {
      const result = await useCase.execute(
        input({ now: SATURDAY, dayOverride: 99 }),
      );
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(1);
    });
  });

  describe('workout status detection', () => {
    it('returns in_progress when workout exists for today with status in_progress', async () => {
      await handle.db.insert(workouts).values({
        userId,
        routineDayId: dayIdByNumber.get(1)!,
        workoutDate: MONDAY,
        status: 'in_progress',
      });

      const result = await useCase.execute(input({ now: MONDAY }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.workoutStatus).toBe('in_progress');
      expect(result.existingWorkoutId).toBeTypeOf('string');
      expect(result.existingWorkoutId).not.toBeNull();
    });

    it('returns completed when workout exists for today with status completed', async () => {
      await handle.db.insert(workouts).values({
        userId,
        routineDayId: dayIdByNumber.get(3)!,
        workoutDate: WEDNESDAY,
        status: 'completed',
        completedAt: new Date('2026-07-29T13:00:00Z'),
      });

      const result = await useCase.execute(input({ now: WEDNESDAY }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.workoutStatus).toBe('completed');
      expect(result.existingWorkoutId).toBeTypeOf('string');
    });

    it('does NOT pick up workout from a different day (date-scoped, Cat 3)', async () => {
      // Monday has an in_progress workout, Friday has none.
      const result = await useCase.execute(input({ now: FRIDAY }));
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.workoutStatus).toBe('not_started');
      expect(result.existingWorkoutId).toBeNull();
    });
  });

  describe('rest_day state (AC-2.1-03)', () => {
    it('returns rest_day on Saturday with dayOptions 1..5', async () => {
      const result = await useCase.execute(input({ now: SATURDAY }));
      expect(result.kind).toBe('rest_day');
      if (result.kind !== 'rest_day') throw new Error('expected rest_day');
      expect(result.dayOptions).toHaveLength(5);
      const dayNumbers = result.dayOptions.map((d) => d.dayNumber);
      expect(dayNumbers).toEqual([1, 2, 3, 4, 5]);
    });

    it('returns rest_day on Sunday with dayOptions 1..5', async () => {
      const result = await useCase.execute(input({ now: SUNDAY }));
      expect(result.kind).toBe('rest_day');
      if (result.kind !== 'rest_day') throw new Error('expected rest_day');
      expect(result.dayOptions).toHaveLength(5);
    });

    it('returns rest_day with weightUnit preserved from input', async () => {
      const result = await useCase.execute(
        input({ now: SATURDAY, weightUnit: 'lbs' }),
      );
      expect(result.kind).toBe('rest_day');
      if (result.kind !== 'rest_day') throw new Error('expected rest_day');
      expect(result.weightUnit).toBe('lbs');
    });

    it('returns workout_day on weekend when dayOverride=1 is provided', async () => {
      const result = await useCase.execute(
        input({ now: SATURDAY, dayOverride: 1 }),
      );
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(1);
    });

    it('returns workout_day on weekend when dayOverride=5 is provided', async () => {
      const result = await useCase.execute(
        input({ now: SUNDAY, dayOverride: 5 }),
      );
      expect(result.kind).toBe('workout_day');
      if (result.kind !== 'workout_day') throw new Error('expected workout_day');
      expect(result.dayNumber).toBe(5);
    });
  });
});
