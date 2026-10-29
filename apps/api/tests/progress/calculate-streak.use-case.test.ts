// tests/progress/calculate-streak.use-case.test.ts
//
// Use case: passthrough to ProgressRepository.getStreak.
// Trivial use case — covered here to confirm wiring + default behavior.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/calculate-streak.use-case';
import { SqliteProgressRepository } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository';
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
let useCase: CalculateStreakUseCase;
let userId: string;
let routineDayId: string;
let benchId: string;

beforeAll(async () => {
  handle = createTestDb();
  const repo = new SqliteProgressRepository(handle.db);
  useCase = new CalculateStreakUseCase(repo);

  const [u] = await handle.db
    .insert(profiles)
    .values({
      email: 'cs@example.com',
      passwordHash: 'h',
      displayName: 'U',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = u.id;

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
    .values({ name: 'Bench', muscleGroup: 'chest' })
    .returning();
  benchId = b.id;
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(workoutEntries);
  await handle.db.delete(workouts);
});

async function seedWorkout(date: Date, status: 'completed' | 'in_progress' = 'completed') {
  const [w] = await handle.db
    .insert(workouts)
    .values({
      userId,
      routineDayId,
      workoutDate: date,
      status,
      startedAt: date,
      completedAt: status === 'completed' ? new Date(date.getTime() + 3600_000) : null,
    })
    .returning();
  return w.id;
}

async function seedEntry(wid: string) {
  await handle.db.insert(workoutEntries).values({
    workoutId: wid,
    exerciseId: benchId,
    setNumber: 1,
    reps: 10,
    weight: 50,
    completed: true,
  });
}

describe('CalculateStreakUseCase', () => {
  it('returns current=0, total=0 for new user', async () => {
    const result = await useCase.execute({ userId });
    expect(result).toEqual({ current: 0, total: 0 });
  });

  it('returns streak with completed workouts', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);
    await seedEntry(await seedWorkout(today));
    await seedEntry(await seedWorkout(yesterday));
    const result = await useCase.execute({ userId });
    expect(result.current).toBe(2);
    expect(result.total).toBe(2);
  });

  it('excludes in_progress workouts from total', async () => {
    await seedEntry(await seedWorkout(new Date('2026-08-01T12:00:00Z')));
    await seedEntry(await seedWorkout(new Date('2026-08-02T12:00:00Z'), 'in_progress'));
    const result = await useCase.execute({ userId });
    expect(result.total).toBe(1);
  });
});
