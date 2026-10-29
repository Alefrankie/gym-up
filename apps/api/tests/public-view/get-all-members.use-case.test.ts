// tests/public-view/get-all-members.use-case.test.ts
//
// Use case: GetAllMembersUseCase
// Fetches all profiles + computes stats per member.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GetAllMembersUseCase } from '@/lib/contexts/public-view/application/get-all-members.use-case';
import { CalculateMemberStatsUseCase } from '@/lib/contexts/public-view/application/calculate-member-stats.use-case';
import { SqlitePublicProfileRepository } from '@/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-profile.repository';
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
let getAllMembersUseCase: GetAllMembersUseCase;
let userId1: string;
let userId2: string;
let routineDayId: string;
let exerciseId: string;

beforeAll(async () => {
  handle = createTestDb();

  const profileRepo = new SqlitePublicProfileRepository(handle.db);
  const workoutRepo = new SqlitePublicWorkoutRepository(handle.db);
  const progressRepo = new SqliteProgressRepository(handle.db);
  const streakUseCase = new CalculateStreakUseCase(progressRepo);
  const statsUseCase = new CalculateMemberStatsUseCase(
    workoutRepo,
    streakUseCase,
  );
  getAllMembersUseCase = new GetAllMembersUseCase(profileRepo, statsUseCase);

  // Seed routine + exercise
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
  await handle.db.delete(profiles);
});

async function seedUser(email: string, displayName: string) {
  const [u] = await handle.db
    .insert(profiles)
    .values({
      email,
      passwordHash: 'h',
      displayName,
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  return u.id;
}

async function seedCompletedWorkout(uid: string, date: Date) {
  const [w] = await handle.db
    .insert(workouts)
    .values({
      userId: uid,
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

describe('GetAllMembersUseCase', () => {
  it('returns empty array when no profiles exist', async () => {
    const result = await getAllMembersUseCase.execute();
    expect(result).toEqual([]);
  });

  it('returns all members with computed stats', async () => {
    userId1 = await seedUser('a@test.com', 'Alice');
    userId2 = await seedUser('b@test.com', 'Bob');

    // Alice: 2 workouts (today + yesterday)
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400_000);
    await seedCompletedWorkout(userId1, today);
    await seedCompletedWorkout(userId1, yesterday);

    // Bob: 1 workout
    await seedCompletedWorkout(userId2, today);

    const result = await getAllMembersUseCase.execute();

    expect(result).toHaveLength(2);

    const alice = result.find((m) => m.displayName === 'Alice');
    expect(alice).toBeDefined();
    expect(alice!.totalWorkouts).toBe(2);
    expect(alice!.currentStreak).toBe(2);
    expect(alice!.lastWorkout).toBe(today.toISOString().split('T')[0]);

    const bob = result.find((m) => m.displayName === 'Bob');
    expect(bob).toBeDefined();
    expect(bob!.totalWorkouts).toBe(1);
    expect(bob!.currentStreak).toBe(1);
  });

  it('does NOT include email (FR-PV-003)', async () => {
    await seedUser('secret@test.com', 'Private');

    const result = await getAllMembersUseCase.execute();
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('email');
  });

  it('returns members with 0 workouts when no workout history', async () => {
    await seedUser('empty@test.com', 'Empty');

    const result = await getAllMembersUseCase.execute();
    expect(result).toHaveLength(1);
    expect(result[0].totalWorkouts).toBe(0);
    expect(result[0].currentStreak).toBe(0);
    expect(result[0].lastWorkout).toBeNull();
  });
});
