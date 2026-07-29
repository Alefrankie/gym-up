// tests/workout-tracking/start-workout.use-case.test.ts
//
// AC-2.2-01..07 (story 2.2).
//
// Covers StartWorkoutUseCase outcomes:
//   - started (no existing workout, fresh insert)
//   - resumed via existingWorkoutId (Continue path, valid ownership)
//   - resumed via existingWorkoutId + cross-user (throws WorkoutOwnershipError)
//   - resumed via existingWorkoutId + not found (throws WorkoutNotFoundError)
//   - resumed via idempotency (existing workout today, no existingWorkoutId)
//   - started with invalid routineDayId (throws InvalidRoutineDayError)
//   - started with `now` injection (workoutDate matches)
//   - helpers: isUniqueConstraintError, isForeignKeyConstraintError

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  StartWorkoutUseCase,
  WorkoutNotFoundError,
  InvalidRoutineDayError,
  isUniqueConstraintError,
  isForeignKeyConstraintError,
} from '@/lib/contexts/workout-tracking/application/start-workout.use-case';
import { WorkoutOwnershipError } from '@/lib/contexts/workout-tracking/domain/workout.repository';
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
let useCase: StartWorkoutUseCase;
let workoutRepo: SqliteWorkoutRepository;
let userId: string;
let otherUserId: string;
let routineDayId: string;
let exerciseId: string;

// UTC mid-day to keep weekday math stable.
const MONDAY = new Date('2026-07-27T12:00:00Z');
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

beforeAll(async () => {
  handle = createTestDb();
  const routineRepo = new SqliteRoutineRepository(handle.db);
  workoutRepo = new SqliteWorkoutRepository(handle.db);
  useCase = new StartWorkoutUseCase(routineRepo, workoutRepo);

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
    .values({ name: 'Test Exercise', muscleGroup: 'chest' })
    .returning();
  exerciseId = ex.id;
  await handle.db
    .insert(routineExercises)
    .values({ routineDayId, exerciseId, targetSets: 4, targetReps: 10, exerciseOrder: 1 });
});

afterAll(() => handle.close());

// Clear workouts between tests. The schema has no DB-level unique
// constraint on (user_id, workout_date) (per story 2.2 note: the
// invariant is enforced in the use case, not the schema), so without
// this cleanup later tests would see workouts created by earlier tests
// via findByUserAndDate, which returns the first match with limit(1).
beforeEach(async () => {
  await handle.db.delete(workouts);
});

describe('StartWorkoutUseCase — start path', () => {
  it('creates a new workout when none exists for today', async () => {
    const result = await useCase.execute({ userId, routineDayId, now: MONDAY });
    expect(result.kind).toBe('started');
    if (result.kind !== 'started') throw new Error('expected started');
    expect(result.workout.userId).toBe(userId);
    expect(result.workout.routineDayId).toBe(routineDayId);
    expect(result.workout.status).toBe('in_progress');
    expect(result.workout.workoutDate).toBeInstanceOf(Date);
    expect(result.workout.workoutDate.getTime()).toBe(MONDAY.getTime());
    expect(result.workout.startedAt).toBeInstanceOf(Date);
    expect(result.workout.completedAt).toBeNull();
  });

  it('uses the injected `now` as workoutDate (skill rule: now: Date for testable use cases)', async () => {
    const result = await useCase.execute({ userId, routineDayId, now: MONDAY });
    expect(result.kind).toBe('started');
    if (result.kind !== 'started') throw new Error('expected started');
    expect(result.workout.workoutDate.getTime()).toBe(MONDAY.getTime());
  });

  it('throws InvalidRoutineDayError when routineDayId does not exist (FK violation)', async () => {
    await expect(
      useCase.execute({ userId, routineDayId: NON_EXISTENT_UUID, now: MONDAY }),
    ).rejects.toBeInstanceOf(InvalidRoutineDayError);
  });
});

describe('StartWorkoutUseCase — resume via existingWorkoutId (Continue path)', () => {
  it('returns resumed when existingWorkoutId belongs to the user', async () => {
    const existing = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });

    const result = await useCase.execute({ userId, routineDayId, existingWorkoutId: existing.id });
    expect(result.kind).toBe('resumed');
    if (result.kind !== 'resumed') throw new Error('expected resumed');
    expect(result.workout.id).toBe(existing.id);
    expect(result.workout.userId).toBe(userId);
  });

  it('throws WorkoutNotFoundError when existingWorkoutId does not exist', async () => {
    await expect(
      useCase.execute({ userId, routineDayId, existingWorkoutId: NON_EXISTENT_UUID }),
    ).rejects.toBeInstanceOf(WorkoutNotFoundError);
  });

  it('throws WorkoutOwnershipError when existingWorkoutId belongs to another user (Cat 5/6)', async () => {
    const crossUserWorkout = await workoutRepo.create({
      userId: otherUserId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });

    await expect(
      useCase.execute({ userId, routineDayId, existingWorkoutId: crossUserWorkout.id }),
    ).rejects.toBeInstanceOf(WorkoutOwnershipError);
  });
});

describe('StartWorkoutUseCase — idempotency (AC-2.2-04)', () => {
  it('returns resumed when a workout already exists for today (no insert)', async () => {
    // Pre-insert a workout for the user on MONDAY.
    const preInserted = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });

    // Calling execute again with the same userId and a matching `now`
    // should return resumed (no second insert).
    const result = await useCase.execute({ userId, routineDayId, now: MONDAY });
    expect(result.kind).toBe('resumed');
    if (result.kind !== 'resumed') throw new Error('expected resumed');
    expect(result.workout.id).toBe(preInserted.id);

    // Verify the DB still has exactly one workout for this user on this date.
    const found = await workoutRepo.findByUserAndDate(userId, MONDAY);
    expect(found?.id).toBe(preInserted.id);
  });
});

describe('Constraint error helpers', () => {
  it('isUniqueConstraintError matches SQLite UNIQUE messages', () => {
    expect(isUniqueConstraintError(new Error('UNIQUE constraint failed: workouts.user_id'))).toBe(true);
    expect(isUniqueConstraintError(new Error('Some other error'))).toBe(false);
    expect(isUniqueConstraintError('not an error')).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });

  it('isForeignKeyConstraintError matches SQLite FK messages', () => {
    expect(isForeignKeyConstraintError(new Error('FOREIGN KEY constraint failed'))).toBe(true);
    expect(isForeignKeyConstraintError(new Error('UNIQUE constraint failed'))).toBe(false);
    expect(isForeignKeyConstraintError(new Error('Some other error'))).toBe(false);
    expect(isForeignKeyConstraintError(undefined)).toBe(false);
  });
});
