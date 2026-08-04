// tests/progress/sqlite-exercise-query.repository.test.ts
//
// Tests for the SQLite-backed ExerciseQueryRepository.
// Per ADR-009: real impl against in-memory SQLite, no mocks.
//
// Covers:
//   - getLoggedExercises: returns distinct exercises user has logged
//   - excludes exercises from in_progress workouts
//   - excludes exercises logged by other users
//   - orders by name ASC
//   - empty when user has no workouts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SqliteExerciseQueryRepository } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-exercise-query.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import {
  exercises,
  routineDays,
  routines,
  workoutEntries,
  workouts,
  profiles,
} from '@db/schema';

let handle: TestDbHandle;
let repo: SqliteExerciseQueryRepository;
let userId: string;
let otherUserId: string;
let routineDayId: string;
let benchPressId: string;
let squatId: string;
let deadliftId: string;

beforeAll(async () => {
  handle = createTestDb();
  repo = new SqliteExerciseQueryRepository(handle.db);

  const [owner] = await handle.db
    .insert(profiles)
    .values({
      email: 'eqr-owner@example.com',
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
      email: 'eqr-other@example.com',
      passwordHash: 'hashed',
      displayName: 'Other',
      routineType: 'mujer',
      weightUnit: 'kg',
    })
    .returning();
  otherUserId = other.id;

  const [routine] = await handle.db
    .insert(routines)
    .values({ name: 'Test', type: 'hombre' })
    .returning();
  const [day] = await handle.db
    .insert(routineDays)
    .values({ routineId: routine.id, dayNumber: 1, dayName: 'Monday', focus: 'Chest' })
    .returning();
  routineDayId = day.id;

  // Exercises with deliberate alphabetical disorder to verify ORDER BY
  const [squat] = await handle.db
    .insert(exercises)
    .values({ name: 'Squat', muscleGroup: 'legs' })
    .returning();
  squatId = squat.id;
  const [bench] = await handle.db
    .insert(exercises)
    .values({ name: 'Bench Press', muscleGroup: 'chest' })
    .returning();
  benchPressId = bench.id;
  const [deadlift] = await handle.db
    .insert(exercises)
    .values({ name: 'Deadlift', muscleGroup: 'back' })
    .returning();
  deadliftId = deadlift.id;
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(workoutEntries);
  await handle.db.delete(workouts);
});

async function seedCompletedWorkout(uid: string, status: 'completed' | 'in_progress' = 'completed') {
  const [w] = await handle.db
    .insert(workouts)
    .values({
      userId: uid,
      routineDayId,
      workoutDate: new Date('2026-08-01T12:00:00Z'),
      status,
      startedAt: new Date('2026-08-01T12:00:00Z'),
      completedAt: status === 'completed' ? new Date('2026-08-01T13:00:00Z') : null,
    })
    .returning();
  return w.id;
}

async function seedEntry(workoutId: string, exerciseId: string, completed = true) {
  await handle.db.insert(workoutEntries).values({
    workoutId,
    exerciseId,
    setNumber: 1,
    reps: 10,
    weight: 60,
    completed,
  });
}

describe('SqliteExerciseQueryRepository — getLoggedExercises', () => {
  it('returns empty array when user has no workouts', async () => {
    const result = await repo.getLoggedExercises(userId);
    expect(result).toEqual([]);
  });

  it('returns distinct exercises user has logged in completed workouts', async () => {
    const wid = await seedCompletedWorkout(userId, 'completed');
    await seedEntry(wid, benchPressId);
    await seedEntry(wid, squatId);
    // Add bench again — should be deduplicated
    await seedEntry(wid, benchPressId);

    const result = await repo.getLoggedExercises(userId);
    expect(result).toHaveLength(2);
    const ids = result.map((e) => e.id);
    expect(ids).toContain(benchPressId);
    expect(ids).toContain(squatId);
  });

  it('excludes exercises from in_progress workouts', async () => {
    const inProgressId = await seedCompletedWorkout(userId, 'in_progress');
    await seedEntry(inProgressId, benchPressId, false);

    const result = await repo.getLoggedExercises(userId);
    expect(result).toEqual([]);
  });

  it('exercises logged across multiple completed workouts are deduplicated', async () => {
    const wid1 = await seedCompletedWorkout(userId, 'completed');
    await handle.db.update(workouts).set({ workoutDate: new Date('2026-08-01T12:00:00Z') }).where(/* hack */);
    // Easier: insert two distinct workouts on different dates
    await handle.db.delete(workouts);
    const w1 = await seedCompletedWorkout(userId, 'completed');
    await handle.db.update(workouts).set({ workoutDate: new Date('2026-07-25T12:00:00Z') });
    const w2 = (await handle.db.insert(workouts).values({
      userId,
      routineDayId,
      workoutDate: new Date('2026-08-01T12:00:00Z'),
      status: 'completed',
      startedAt: new Date('2026-08-01T12:00:00Z'),
      completedAt: new Date('2026-08-01T13:00:00Z'),
    }).returning())[0].id;
    await seedEntry(w1, benchPressId);
    await seedEntry(w2, benchPressId);
    await seedEntry(w2, squatId);

    const result = await repo.getLoggedExercises(userId);
    expect(result).toHaveLength(2);
  });

  it('excludes exercises logged by other users', async () => {
    const myWid = await seedCompletedWorkout(userId, 'completed');
    const otherWid = await seedCompletedWorkout(otherUserId, 'completed');
    await seedEntry(myWid, benchPressId);
    await seedEntry(otherWid, deadliftId);

    const result = await repo.getLoggedExercises(userId);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(benchPressId);
  });

  it('orders results by exercise name ASC', async () => {
    const wid = await seedCompletedWorkout(userId, 'completed');
    // Insert in non-alphabetical order
    await seedEntry(wid, squatId);
    await seedEntry(wid, benchPressId);
    await seedEntry(wid, deadliftId);

    const result = await repo.getLoggedExercises(userId);
    expect(result.map((e) => e.name)).toEqual(['Bench Press', 'Deadlift', 'Squat']);
  });
});
