// tests/workout-tracking/log-set.use-case.test.ts
//
// AC-2.4-01..09 (story 2.4).
//
// Covers every state of the LogSetUseCase:
//   - created (no existing entry)
//   - updated (existing entry for same set)
//   - weight conversion (kg → kg, lbs → kg)
//   - validation (reps, weight, setNumber, notes range)
//   - ownership (cross-user rejected)
//   - workout not found
//   - idempotency (same set saved twice → one entry, second call updates)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  LogSetUseCase,
  LogSetValidationError,
  WorkoutNotFoundError,
  type LogSetInput,
} from '@/lib/contexts/workout-tracking/application/log-set.use-case';
import { WorkoutOwnershipError } from '@/lib/contexts/workout-tracking/domain/workout.repository';
import { SqliteRoutineRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import {
  exercises,
  profiles,
  routineDays,
  routines,
  workouts,
} from '@db/schema';

let handle: TestDbHandle;
let useCase: LogSetUseCase;
let workoutRepo: SqliteWorkoutRepository;
let userId: string;
let otherUserId: string;
let routineDayId: string;
let exerciseId: string;

const MONDAY = new Date('2026-07-27T12:00:00Z');
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

beforeAll(async () => {
  handle = createTestDb();
  const routineRepo = new SqliteRoutineRepository(handle.db);
  workoutRepo = new SqliteWorkoutRepository(handle.db);
  useCase = new LogSetUseCase(workoutRepo);

  const [owner] = await handle.db
    .insert(profiles)
    .values({
      email: 'owner@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Owner',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = owner.id;

  const [other] = await handle.db
    .insert(profiles)
    .values({
      email: 'other@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Other',
      routineType: 'mujer',
      weightUnit: 'kg',
    })
    .returning();
  otherUserId = other.id;

  const [routine] = await handle.db
    .insert(routines)
    .values({ name: 'Test Routine', type: 'hombre' })
    .returning();
  const [day] = await handle.db
    .insert(routineDays)
    .values({ routineId: routine.id, dayNumber: 1, dayName: 'Monday', focus: 'Test' })
    .returning();
  routineDayId = day.id;

  const [ex] = await handle.db
    .insert(exercises)
    .values({ name: 'Bench Press', muscleGroup: 'chest' })
    .returning();
  exerciseId = ex.id;
});

afterAll(() => handle.close());

// Clear workouts between tests (cascades to workoutEntries). The schema
// has no DB-level unique constraint on (user_id, workout_date) — same
// situation as 2.2 — so without this cleanup, later tests would see
// workouts created by earlier tests via findByUserAndDate.
beforeEach(async () => {
  await handle.db.delete(workouts);
});

function input(overrides: Partial<LogSetInput> = {}): LogSetInput {
  return {
    userId,
    workoutId: '', // set per test
    exerciseId,
    setNumber: 1,
    reps: 10,
    weight: 60,
    weightUnit: 'kg',
    completed: false,
    notes: null,
    ...overrides,
  };
}

describe('LogSetUseCase — start path (no existing entry)', () => {
  it('creates a new entry and returns { kind: "created" } with weight in kg', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    const result = await useCase.execute(input({ workoutId: workout.id }));
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') throw new Error('expected created');
    expect(result.entry.workoutId).toBe(workout.id);
    expect(result.entry.exerciseId).toBe(exerciseId);
    expect(result.entry.setNumber).toBe(1);
    expect(result.entry.reps).toBe(10);
    expect(result.entry.weight).toBe(60);
    expect(result.entry.completed).toBe(false);
    expect(result.entry.notes).toBeNull();
  });

  it('converts weight from lbs to kg (AC-2.4-08)', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    const result = await useCase.execute(
      input({ workoutId: workout.id, weight: 100, weightUnit: 'lbs' }),
    );
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') throw new Error('expected created');
    // 100 lbs × 0.453592 = 45.3592 kg
    expect(Math.abs(result.entry.weight - 45.3592)).toBeLessThan(0.01);
  });

  it('does not convert weight when user is on kg', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    const result = await useCase.execute(
      input({ workoutId: workout.id, weight: 60, weightUnit: 'kg' }),
    );
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') throw new Error('expected created');
    expect(result.entry.weight).toBe(60);
  });
});

describe('LogSetUseCase — update path (existing entry)', () => {
  it('updates the existing entry and returns { kind: "updated" }', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    // First call creates
    await useCase.execute(input({ workoutId: workout.id, reps: 8, weight: 50 }));
    // Second call updates
    const result = await useCase.execute(
      input({ workoutId: workout.id, reps: 12, weight: 60, completed: true }),
    );
    expect(result.kind).toBe('updated');
    if (result.kind !== 'updated') throw new Error('expected updated');
    expect(result.entry.reps).toBe(12);
    expect(result.entry.weight).toBe(60);
    expect(result.entry.completed).toBe(true);

    // Verify only one entry exists in the DB.
    const allEntries = await workoutRepo.findEntries(workout.id);
    expect(allEntries).toHaveLength(1);
  });

  it('is idempotent: same input twice yields one entry, second call returns the same id', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    const first = await useCase.execute(input({ workoutId: workout.id }));
    const second = await useCase.execute(input({ workoutId: workout.id }));
    expect(first.kind).toBe('created');
    expect(second.kind).toBe('updated');
    if (first.kind !== 'created' || second.kind !== 'updated') {
      throw new Error('expected kinds');
    }
    expect(second.entry.id).toBe(first.entry.id);
  });

  it('stores notes when provided', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    const result = await useCase.execute(
      input({ workoutId: workout.id, notes: 'felt good on last rep' }),
    );
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') throw new Error('expected created');
    expect(result.entry.notes).toBe('felt good on last rep');
  });
});

describe('LogSetUseCase — validation', () => {
  async function newWorkout() {
    return workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
  }

  it('rejects reps < 1', async () => {
    const w = await newWorkout();
    await expect(useCase.execute(input({ workoutId: w.id, reps: 0 }))).rejects.toBeInstanceOf(
      LogSetValidationError,
    );
  });

  it('rejects reps > 100', async () => {
    const w = await newWorkout();
    await expect(useCase.execute(input({ workoutId: w.id, reps: 101 }))).rejects.toBeInstanceOf(
      LogSetValidationError,
    );
  });

  it('rejects weight < 0', async () => {
    const w = await newWorkout();
    await expect(useCase.execute(input({ workoutId: w.id, weight: -1 }))).rejects.toBeInstanceOf(
      LogSetValidationError,
    );
  });

  it('rejects weight > 500', async () => {
    const w = await newWorkout();
    await expect(useCase.execute(input({ workoutId: w.id, weight: 501 }))).rejects.toBeInstanceOf(
      LogSetValidationError,
    );
  });

  it('rejects setNumber < 1', async () => {
    const w = await newWorkout();
    await expect(useCase.execute(input({ workoutId: w.id, setNumber: 0 }))).rejects.toBeInstanceOf(
      LogSetValidationError,
    );
  });

  it('rejects setNumber > 10 (WorkoutEntryRules.MaxSetsPerExercise)', async () => {
    const w = await newWorkout();
    await expect(useCase.execute(input({ workoutId: w.id, setNumber: 11 }))).rejects.toBeInstanceOf(
      LogSetValidationError,
    );
  });

  it('rejects notes longer than 500 chars', async () => {
    const w = await newWorkout();
    const longNotes = 'a'.repeat(501);
    await expect(useCase.execute(input({ workoutId: w.id, notes: longNotes }))).rejects.toBeInstanceOf(
      LogSetValidationError,
    );
  });

  it('accepts notes exactly 500 chars (boundary)', async () => {
    const w = await newWorkout();
    const notes = 'a'.repeat(500);
    const result = await useCase.execute(input({ workoutId: w.id, notes }));
    expect(result.kind).toBe('created');
  });
});

describe('LogSetUseCase — ownership + not found', () => {
  it('throws WorkoutOwnershipError when userId mismatches workout owner (Cat 5/6)', async () => {
    const w = await workoutRepo.create({
      userId: otherUserId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    await expect(useCase.execute(input({ workoutId: w.id }))).rejects.toBeInstanceOf(
      WorkoutOwnershipError,
    );
  });

  it('throws WorkoutNotFoundError when workoutId does not exist', async () => {
    await expect(
      useCase.execute(input({ workoutId: NON_EXISTENT_UUID })),
    ).rejects.toBeInstanceOf(WorkoutNotFoundError);
  });
});
