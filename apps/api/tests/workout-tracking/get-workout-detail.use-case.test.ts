// tests/workout-tracking/get-workout-detail.use-case.test.ts
//
// AC-3.1-04: Tap entry → expand for full set detail
//
// Covers GetWorkoutDetailUseCase outcomes:
//   - 404: workoutId does not exist
//   - 403: workout belongs to another user (cross-user)
//   - happy path: returns workout + entries with exercise names
//   - in-progress workout with 0 entries (returns empty array, not error)
//   - entry ordering: (exercise_id, set_number) preserved

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  GetWorkoutDetailUseCase,
  WorkoutNotFoundError,
  WorkoutAccessDeniedError,
} from '@/lib/contexts/workout-tracking/application/get-workout-detail.use-case';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { exercises, profiles, routineDays, routines, workoutEntries, workouts } from '@db/schema';

let handle: TestDbHandle;
let useCase: GetWorkoutDetailUseCase;
let userId: string;
let otherUserId: string;
let routineDayId: string;
let exerciseAId: string;
let exerciseBId: string;

beforeAll(async () => {
  handle = createTestDb();
  const workoutRepo = new SqliteWorkoutRepository(handle.db);
  useCase = new GetWorkoutDetailUseCase(workoutRepo);

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
    .values({ routineId: routine.id, dayNumber: 1, dayName: 'Monday', focus: 'Chest' })
    .returning();
  routineDayId = day.id;

  const [exA] = await handle.db
    .insert(exercises)
    .values({ name: 'Bench Press', muscleGroup: 'chest' })
    .returning();
  exerciseAId = exA.id;

  const [exB] = await handle.db
    .insert(exercises)
    .values({ name: 'Squat', muscleGroup: 'legs' })
    .returning();
  exerciseBId = exB.id;
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(workoutEntries);
  await handle.db.delete(workouts);
});

describe('GetWorkoutDetailUseCase — error cases', () => {
  it('throws WorkoutNotFoundError when workoutId does not exist (404)', async () => {
    await expect(
      useCase.execute({ userId, workoutId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toBeInstanceOf(WorkoutNotFoundError);
  });

  it('throws WorkoutAccessDeniedError when workout belongs to another user (403)', async () => {
    const [otherWorkout] = await handle.db
      .insert(workouts)
      .values({
        userId: otherUserId,
        routineDayId,
        workoutDate: new Date('2026-07-25T12:00:00Z'),
        status: 'completed',
        startedAt: new Date('2026-07-25T12:00:00Z'),
        completedAt: new Date('2026-07-25T13:00:00Z'),
      })
      .returning();

    await expect(
      useCase.execute({ userId, workoutId: otherWorkout.id }),
    ).rejects.toBeInstanceOf(WorkoutAccessDeniedError);
  });
});

describe('GetWorkoutDetailUseCase — happy path', () => {
  it('returns workout + entries with exercise names', async () => {
    const [w] = await handle.db
      .insert(workouts)
      .values({
        userId,
        routineDayId,
        workoutDate: new Date('2026-07-25T12:00:00Z'),
        status: 'completed',
        startedAt: new Date('2026-07-25T12:00:00Z'),
        completedAt: new Date('2026-07-25T13:00:00Z'),
      })
      .returning();

    await handle.db.insert(workoutEntries).values({
      workoutId: w.id,
      exerciseId: exerciseAId,
      setNumber: 1,
      reps: 10,
      weight: 60,
      completed: true,
      notes: 'Felt strong',
    });
    await handle.db.insert(workoutEntries).values({
      workoutId: w.id,
      exerciseId: exerciseBId,
      setNumber: 1,
      reps: 12,
      weight: 80,
      completed: true,
      notes: null,
    });

    const result = await useCase.execute({ userId, workoutId: w.id });
    expect(result.workout.id).toBe(w.id);
    expect(result.entries).toHaveLength(2);

    // Build a lookup by (exerciseName, setNumber) since UUIDs are random
    // and the order between exerciseA and exerciseB is not deterministic.
    const lookup = new Map(
      result.entries.map((e) => [`${e.exerciseName}:${e.setNumber}`, e]),
    );
    const benchEntry = lookup.get('Bench Press:1');
    const squatEntry = lookup.get('Squat:1');

    expect(benchEntry).toBeDefined();
    expect(benchEntry?.muscleGroup).toBe('chest');
    expect(benchEntry?.reps).toBe(10);
    expect(benchEntry?.weight).toBe(60);
    expect(benchEntry?.notes).toBe('Felt strong');

    expect(squatEntry).toBeDefined();
    expect(squatEntry?.muscleGroup).toBe('legs');
    expect(squatEntry?.reps).toBe(12);
    expect(squatEntry?.weight).toBe(80);
    expect(squatEntry?.notes).toBeNull();
  });

  it('preserves entry ordering by set_number within each exercise', async () => {
    const [w] = await handle.db
      .insert(workouts)
      .values({
        userId,
        routineDayId,
        workoutDate: new Date('2026-07-25T12:00:00Z'),
        status: 'completed',
        startedAt: new Date('2026-07-25T12:00:00Z'),
        completedAt: new Date('2026-07-25T13:00:00Z'),
      })
      .returning();

    // Insert in non-sorted order to prove the SQL ORDER BY does the work.
    await handle.db.insert(workoutEntries).values({
      workoutId: w.id,
      exerciseId: exerciseAId,
      setNumber: 2,
      reps: 8,
      weight: 65,
      completed: true,
    });
    await handle.db.insert(workoutEntries).values({
      workoutId: w.id,
      exerciseId: exerciseAId,
      setNumber: 1,
      reps: 10,
      weight: 60,
      completed: true,
    });
    await handle.db.insert(workoutEntries).values({
      workoutId: w.id,
      exerciseId: exerciseBId,
      setNumber: 1,
      reps: 12,
      weight: 80,
      completed: true,
    });

    const result = await useCase.execute({ userId, workoutId: w.id });
    expect(result.entries).toHaveLength(3);

    // Group by exerciseName and verify setNumber is ascending within each group.
    const byExercise = new Map<string, number[]>();
    for (const entry of result.entries) {
      if (!byExercise.has(entry.exerciseName)) {
        byExercise.set(entry.exerciseName, []);
      }
      byExercise.get(entry.exerciseName)!.push(entry.setNumber);
    }

    // Each exercise's sets must be in ascending order.
    expect(byExercise.get('Bench Press')).toEqual([1, 2]);
    expect(byExercise.get('Squat')).toEqual([1]);
  });

  it('returns empty entries array for in-progress workout with 0 entries', async () => {
    const [w] = await handle.db
      .insert(workouts)
      .values({
        userId,
        routineDayId,
        workoutDate: new Date('2026-07-25T12:00:00Z'),
        status: 'in_progress',
        startedAt: new Date('2026-07-25T12:00:00Z'),
        completedAt: null,
      })
      .returning();

    const result = await useCase.execute({ userId, workoutId: w.id });
    expect(result.workout.id).toBe(w.id);
    expect(result.entries).toEqual([]);
  });
});
