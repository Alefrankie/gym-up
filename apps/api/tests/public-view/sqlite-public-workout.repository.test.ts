// tests/public-view/sqlite-public-workout.repository.test.ts
//
// Repository: SqlitePublicWorkoutRepository
// Tests getCompletedCount(), getLastWorkoutDate(), getCompletedByUserId().

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SqlitePublicWorkoutRepository } from '@/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-workout.repository';
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
let repo: SqlitePublicWorkoutRepository;
let userId: string;
let routineDayId: string;
let exerciseId: string;

beforeAll(async () => {
  handle = createTestDb();
  repo = new SqlitePublicWorkoutRepository(handle.db);

  const [user] = await handle.db
    .insert(profiles)
    .values({
      email: 'pw@test.com',
      passwordHash: 'h',
      displayName: 'Test',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = user.id;

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

async function seedWorkout(
  date: Date,
  status: 'completed' | 'in_progress' = 'completed',
) {
  const [w] = await handle.db
    .insert(workouts)
    .values({
      userId,
      routineDayId,
      workoutDate: date,
      status,
      startedAt: date,
      completedAt:
        status === 'completed' ? new Date(date.getTime() + 3600_000) : null,
    })
    .returning();
  return w.id;
}

async function seedEntry(wid: string) {
  await handle.db.insert(workoutEntries).values({
    workoutId: wid,
    exerciseId,
    setNumber: 1,
    reps: 10,
    weight: 50,
    completed: true,
  });
}

describe('SqlitePublicWorkoutRepository', () => {
  describe('getCompletedCount', () => {
    it('returns 0 when no workouts exist', async () => {
      const count = await repo.getCompletedCount(userId);
      expect(count).toBe(0);
    });

    it('counts only completed workouts', async () => {
      await seedEntry(await seedWorkout(new Date('2026-08-01T12:00:00Z')));
      await seedEntry(await seedWorkout(new Date('2026-08-02T12:00:00Z')));
      await seedWorkout(new Date('2026-08-03T12:00:00Z'), 'in_progress');

      const count = await repo.getCompletedCount(userId);
      expect(count).toBe(2);
    });

    it('returns 0 for user with no workouts', async () => {
      const count = await repo.getCompletedCount('non-existent-user');
      expect(count).toBe(0);
    });
  });

  describe('getLastWorkoutDate', () => {
    it('returns null when no completed workouts', async () => {
      const result = await repo.getLastWorkoutDate(userId);
      expect(result).toBeNull();
    });

    it('returns most recent completed workout date as YYYY-MM-DD', async () => {
      await seedEntry(await seedWorkout(new Date('2026-08-01T12:00:00Z')));
      await seedEntry(await seedWorkout(new Date('2026-08-05T12:00:00Z')));

      const result = await repo.getLastWorkoutDate(userId);
      expect(result).toBe('2026-08-05');
    });

    it('ignores in_progress workouts', async () => {
      await seedWorkout(new Date('2026-08-10T12:00:00Z'), 'in_progress');

      const result = await repo.getLastWorkoutDate(userId);
      expect(result).toBeNull();
    });
  });

  describe('getCompletedByUserId', () => {
    it('returns empty array when no workouts', async () => {
      const result = await repo.getCompletedByUserId(userId);
      expect(result).toEqual([]);
    });

    it('returns completed workouts ordered by date ASC', async () => {
      await seedEntry(await seedWorkout(new Date('2026-08-03T12:00:00Z')));
      await seedEntry(await seedWorkout(new Date('2026-08-01T12:00:00Z')));

      const result = await repo.getCompletedByUserId(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBeDefined();
      expect(result[0].workoutDate).toBeInstanceOf(Date);
      // Oldest first
      expect(result[0].workoutDate.getTime()).toBeLessThan(
        result[1].workoutDate.getTime(),
      );
    });

    it('excludes in_progress workouts', async () => {
      await seedEntry(await seedWorkout(new Date('2026-08-01T12:00:00Z')));
      await seedWorkout(new Date('2026-08-02T12:00:00Z'), 'in_progress');

      const result = await repo.getCompletedByUserId(userId);
      expect(result).toHaveLength(1);
    });
  });
});
