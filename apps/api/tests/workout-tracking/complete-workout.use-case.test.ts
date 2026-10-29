// tests/workout-tracking/complete-workout.use-case.test.ts
//
// AC-2.6-01, 06, 09 (story 2.6).
//
// Covers every state of the CompleteWorkoutUseCase:
//   - no entries → NoEntriesError (AC-2.6-06)
//   - with entries → returns updated workout with status='completed' + completedAt=now
//   - re-completion allowed (AC-2.6-05) → re-sets completedAt
//   - custom now injection (AC-2.6-07) → completedAt equals injected value
//   - cross-user → WorkoutOwnershipError (AC-2.6-09)
//   - workout not found → WorkoutNotFoundError (AC-2.6-09)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  CompleteWorkoutUseCase,
  NoEntriesError,
  WorkoutNotFoundError as UseCaseWorkoutNotFoundError,
} from '@/lib/contexts/workout-tracking/application/complete-workout.use-case';
import {
  WorkoutOwnershipError,
} from '@/lib/contexts/workout-tracking/domain/workout.repository';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { exercises, profiles, routineDays, routines, workouts, workoutEntries } from '@db/schema';

let handle: TestDbHandle;
let useCase: CompleteWorkoutUseCase;
let workoutRepo: SqliteWorkoutRepository;
let userId: string;
let otherUserId: string;
let routineDayId: string;
let exerciseId: string;

const MONDAY = new Date('2026-07-27T12:00:00Z');
const COMPLETED_AT = new Date('2026-07-27T13:30:00Z'); // 1h 30m after MONDAY
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

beforeAll(async () => {
  handle = createTestDb();
  workoutRepo = new SqliteWorkoutRepository(handle.db);
  useCase = new CompleteWorkoutUseCase(workoutRepo);

  const [owner] = await handle.db
    .insert(profiles)
    .values({
      email: 'owner@example.com',
      passwordHash: 'hashed',
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
      passwordHash: 'hashed',
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

// Clear workout_entries and workouts between tests (no DB unique constraint).
beforeEach(async () => {
  await handle.db.delete(workoutEntries);
  await handle.db.delete(workouts);
});

describe('CompleteWorkoutUseCase — happy path (with entries)', () => {
  it('marks the workout as completed with completedAt=now and returns the updated workout', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    // Add at least one entry so the "no entries" check passes.
    await workoutRepo.addEntry(
      workout.id,
      {
        exerciseId,
        setNumber: 1,
        reps: 10,
        weight: 60,
        completed: true,
        notes: null,
      },
      userId,
    );

    const result = await useCase.execute({
      userId,
      workoutId: workout.id,
      now: COMPLETED_AT,
    });
    expect(result.workout.id).toBe(workout.id);
    expect(result.workout.status).toBe('completed');
    expect(result.workout.completedAt).toBeInstanceOf(Date);
    expect(result.workout.completedAt?.getTime()).toBe(COMPLETED_AT.getTime());
  });

  it('uses the injected `now` as completedAt (AC-2.6-07)', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    await workoutRepo.addEntry(
      workout.id,
      { exerciseId, setNumber: 1, reps: 5, weight: 50, completed: false, notes: null },
      userId,
    );
    const customNow = new Date('2026-12-31T23:59:00Z');
    const result = await useCase.execute({
      userId,
      workoutId: workout.id,
      now: customNow,
    });
    expect(result.workout.completedAt?.getTime()).toBe(customNow.getTime());
  });
});

describe('CompleteWorkoutUseCase — re-completion allowed (AC-2.6-05)', () => {
  it('re-completion overwrites completedAt with the new value', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    await workoutRepo.addEntry(
      workout.id,
      { exerciseId, setNumber: 1, reps: 5, weight: 50, completed: false, notes: null },
      userId,
    );

    // First completion
    const first = await useCase.execute({
      userId,
      workoutId: workout.id,
      now: COMPLETED_AT,
    });
    expect(first.workout.completedAt?.getTime()).toBe(COMPLETED_AT.getTime());

    // Re-completion 10 minutes later
    const later = new Date(COMPLETED_AT.getTime() + 10 * 60 * 1000);
    const second = await useCase.execute({
      userId,
      workoutId: workout.id,
      now: later,
    });
    expect(second.workout.status).toBe('completed');
    expect(second.workout.completedAt?.getTime()).toBe(later.getTime());
  });
});

describe('CompleteWorkoutUseCase — validation: no entries (AC-2.6-06)', () => {
  it('throws NoEntriesError when the workout has no entries', async () => {
    const workout = await workoutRepo.create({
      userId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    await expect(useCase.execute({ userId, workoutId: workout.id, now: COMPLETED_AT })).rejects.toBeInstanceOf(
      NoEntriesError,
    );
  });
});

describe('CompleteWorkoutUseCase — ownership + not found (AC-2.6-09)', () => {
  it('throws WorkoutOwnershipError when userId mismatches workout owner', async () => {
    const workout = await workoutRepo.create({
      userId: otherUserId,
      routineDayId,
      workoutDate: MONDAY,
      status: 'in_progress',
    });
    await expect(useCase.execute({ userId, workoutId: workout.id, now: COMPLETED_AT })).rejects.toBeInstanceOf(
      WorkoutOwnershipError,
    );
  });

  it('throws WorkoutNotFoundError when workoutId does not exist', async () => {
    // The use case throws its own WorkoutNotFoundError (per AC-2.6-09).
    // The endpoint maps it to 404.
    await expect(
      useCase.execute({ userId, workoutId: NON_EXISTENT_UUID, now: COMPLETED_AT }),
    ).rejects.toBeInstanceOf(UseCaseWorkoutNotFoundError);
  });
});
