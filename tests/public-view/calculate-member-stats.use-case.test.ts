// tests/public-view/calculate-member-stats.use-case.test.ts
//
// Use case: CalculateMemberStatsUseCase
// Computes totalWorkouts, currentStreak, lastWorkout for a single user.
// Wraps calculateStreakUseCase + public-workout queries.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CalculateMemberStatsUseCase } from '@/lib/contexts/public-view/application/calculate-member-stats.use-case';
import { SqlitePublicWorkoutRepository } from '@/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-workout.repository';
import { SqliteProgressRepository } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/calculate-streak.use-case';
import { createTestDb, type TestDbHandle } from './test-db';
import {
  profiles,
  workouts,
  workoutEntries,
  exercises,
  routines,
  routineDays,
} from '@db/schema';

let handle: TestDbHandle;
let useCase: CalculateMemberStatsUseCase;
let userId: string;
let routineDayId: string;
let exerciseId: string;

beforeAll(async () => {
  handle = createTestDb();
  const workoutRepo = new SqlitePublicWorkoutRepository(handle.db);
  const progressRepo = new SqliteProgressRepository(handle.db);
  const streakUseCase = new CalculateStreakUseCase(progressRepo);
  useCase = new CalculateMemberStatsUseCase(workoutRepo, streakUseCase);

  const [u] = await handle.db
    .insert(profiles)
    .values({
      email: 'cms@test.com',
      passwordHash: 'h',
      displayName: 'Test',
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
    .values({ routineId: r.id, dayNumber: 1, dayName: 'L', focus: 'C' })
    .returning();
  routineDayId = d.id;
  const [e] = await handle.db
    .insert(exercises)
    .values({ name: 'Bench', muscleGroup: 'chest' })
    .returning();
  exerciseId = e.id;
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(workoutEntries);
  await handle.db.delete(workouts);
});

async function seedCompletedWorkout(date: Date) {
  const [w] = await handle.db
    .insert(workouts)
    .values({
      userId,
      routineDayId,
      workoutDate: date,
      status: 'completed',
      startedAt: date,
      completedAt: new Date(date.getTime() + 3600_000),
    })
    .returning();
  await handle.db.insert(workoutEntries).values({
    workoutId: w.id,
    exerciseId,
    setNumber: 1,
    reps: 10,
    weight: 50,
    completed: true,
  });
}

describe('CalculateMemberStatsUseCase', () => {
  it('returns zero stats for user with no workouts', async () => {
    const result = await useCase.execute({ userId });
    expect(result).toEqual({
      totalWorkouts: 0,
      currentStreak: 0,
      lastWorkout: null,
    });
  });

  it('computes total, streak, and lastWorkout correctly', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400_000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 86400_000);

    await seedCompletedWorkout(twoDaysAgo);
    await seedCompletedWorkout(yesterday);
    await seedCompletedWorkout(today);

    const result = await useCase.execute({ userId });

    expect(result.totalWorkouts).toBe(3);
    expect(result.currentStreak).toBe(3);
    expect(result.lastWorkout).toBe(today.toISOString().split('T')[0]);
  });

  it('ignores in_progress workouts', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    await seedCompletedWorkout(today);

    const [w] = await handle.db
      .insert(workouts)
      .values({
        userId,
        routineDayId,
        workoutDate: new Date(today.getTime() + 3600_000),
        status: 'in_progress',
        startedAt: new Date(),
      })
      .returning();

    const result = await useCase.execute({ userId });
    expect(result.totalWorkouts).toBe(1);
  });
});
