// tests/progress/get-exercise-list.use-case.test.ts
//
// Use case: fetch distinct exercises the user has logged in completed workouts.
// Per ADR-009: real impl against in-memory SQLite, no mocks.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GetExerciseListUseCase } from '@/lib/contexts/progress/application/get-exercise-list.use-case';
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
let useCase: GetExerciseListUseCase;
let userId: string;
let otherUserId: string;
let routineDayId: string;
let benchId: string;
let squatId: string;
let deadliftId: string;

beforeAll(async () => {
  handle = createTestDb();
  const repo = new SqliteExerciseQueryRepository(handle.db);
  useCase = new GetExerciseListUseCase(repo);

  const [owner] = await handle.db
    .insert(profiles)
    .values({
      email: 'gel-owner@example.com',
      passwordHash: 'h',
      displayName: 'O',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = owner.id;

  const [other] = await handle.db
    .insert(profiles)
    .values({
      email: 'gel-other@example.com',
      passwordHash: 'h',
      displayName: 'X',
      routineType: 'mujer',
      weightUnit: 'kg',
    })
    .returning();
  otherUserId = other.id;

  const [r] = await handle.db
    .insert(routines)
    .values({ name: 'T', type: 'hombre' })
    .returning();
  const [d] = await handle.db
    .insert(routineDays)
    .values({ routineId: r.id, dayNumber: 1, dayName: 'M', focus: 'C' })
    .returning();
  routineDayId = d.id;

  const [b] = await handle.db
    .insert(exercises)
    .values({ name: 'Bench Press', muscleGroup: 'chest' })
    .returning();
  benchId = b.id;
  const [s] = await handle.db
    .insert(exercises)
    .values({ name: 'Squat', muscleGroup: 'legs' })
    .returning();
  squatId = s.id;
  const [dl] = await handle.db
    .insert(exercises)
    .values({ name: 'Deadlift', muscleGroup: 'back' })
    .returning();
  deadliftId = dl.id;
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(workoutEntries);
  await handle.db.delete(workouts);
});

async function seedCompleted(uid: string, status: 'completed' | 'in_progress' = 'completed') {
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

async function seedEntry(wid: string, exId: string, completed = true) {
  await handle.db.insert(workoutEntries).values({
    workoutId: wid,
    exerciseId: exId,
    setNumber: 1,
    reps: 10,
    weight: 50,
    completed,
  });
}

describe('GetExerciseListUseCase', () => {
  it('returns empty array when user has no workouts', async () => {
    const result = await useCase.execute({ userId });
    expect(result).toEqual([]);
  });

  it('returns distinct exercises user has logged', async () => {
    const wid = await seedCompleted(userId);
    await seedEntry(wid, benchId);
    await seedEntry(wid, squatId);
    await seedEntry(wid, benchId); // duplicate — should be deduped

    const result = await useCase.execute({ userId });
    expect(result).toHaveLength(2);
    const ids = result.map((e) => e.id);
    expect(ids).toContain(benchId);
    expect(ids).toContain(squatId);
  });

  it('excludes exercises from in_progress workouts', async () => {
    const wid = await seedCompleted(userId, 'in_progress');
    await seedEntry(wid, benchId, false);
    const result = await useCase.execute({ userId });
    expect(result).toEqual([]);
  });

  it('excludes exercises logged by other users', async () => {
    const myWid = await seedCompleted(userId);
    const otherWid = await seedCompleted(otherUserId);
    await seedEntry(myWid, benchId);
    await seedEntry(otherWid, deadliftId);

    const result = await useCase.execute({ userId });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(benchId);
  });

  it('returns exercises ordered by name ASC', async () => {
    const wid = await seedCompleted(userId);
    await seedEntry(wid, squatId);
    await seedEntry(wid, benchId);
    await seedEntry(wid, deadliftId);

    const result = await useCase.execute({ userId });
    expect(result.map((e) => e.name)).toEqual(['Bench Press', 'Deadlift', 'Squat']);
  });
});
