// tests/progress/sqlite-progress.repository.test.ts
//
// Tests for the SQLite-backed ProgressRepository.
// Per ADR-009: real impl against in-memory SQLite, no mocks.
//
// Covers:
//   - getExerciseHistory: filtering, date ordering, date cutoff (since)
//   - getCalendarData: N days, hasWorkout binary
//   - getStreak: consecutive days, gap, today vs yesterday, total

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
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
let repo: SqliteProgressRepository;
let userId: string;
let otherUserId: string;
let routineDayId: string;
let benchPressId: string;
let squatId: string;

beforeAll(async () => {
  handle = createTestDb();
  repo = new SqliteProgressRepository(handle.db);

  // Owner user
  const [owner] = await handle.db
    .insert(profiles)
    .values({
      email: 'progress-owner@example.com',
      passwordHash: 'hashed',
      displayName: 'Owner',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = owner.id;

  // Other user (for cross-user isolation tests)
  const [other] = await handle.db
    .insert(profiles)
    .values({
      email: 'progress-other@example.com',
      passwordHash: 'hashed',
      displayName: 'Other',
      routineType: 'mujer',
      weightUnit: 'kg',
    })
    .returning();
  otherUserId = other.id;

  // Routine scaffold (required by FK on workouts.routine_day_id)
  const [routine] = await handle.db
    .insert(routines)
    .values({ name: 'Test', type: 'hombre' })
    .returning();
  const [day] = await handle.db
    .insert(routineDays)
    .values({ routineId: routine.id, dayNumber: 1, dayName: 'Monday', focus: 'Chest' })
    .returning();
  routineDayId = day.id;

  // Two exercises
  const [bench] = await handle.db
    .insert(exercises)
    .values({ name: 'Bench Press', muscleGroup: 'chest' })
    .returning();
  benchPressId = bench.id;
  const [squat] = await handle.db
    .insert(exercises)
    .values({ name: 'Squat', muscleGroup: 'legs' })
    .returning();
  squatId = squat.id;
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(workoutEntries);
  await handle.db.delete(workouts);
});

/** Helper: insert a completed workout on the given date for userId. */
async function seedCompletedWorkout(
  uid: string,
  date: Date,
  status: 'completed' | 'in_progress' = 'completed',
) {
  const [w] = await handle.db
    .insert(workouts)
    .values({
      userId: uid,
      routineDayId,
      workoutDate: date,
      status,
      startedAt: date,
      completedAt: status === 'completed' ? new Date(date.getTime() + 3600_000) : null,
    })
    .returning();
  return w.id;
}

async function seedEntry(
  workoutId: string,
  exerciseId: string,
  reps: number,
  weight: number,
  completed: boolean = true,
) {
  await handle.db.insert(workoutEntries).values({
    workoutId,
    exerciseId,
    setNumber: 1,
    reps,
    weight,
    completed,
  });
}

// ============================================================================
// getExerciseHistory
// ============================================================================

describe('SqliteProgressRepository — getExerciseHistory', () => {
  it('returns empty array when user has no workouts', async () => {
    const rows = await repo.getExerciseHistory(userId, benchPressId, null);
    expect(rows).toEqual([]);
  });

  it('returns entries for completed workouts only (excludes in_progress)', async () => {
    const completedId = await seedCompletedWorkout(userId, new Date('2026-08-01T12:00:00Z'), 'completed');
    const inProgressId = await seedCompletedWorkout(userId, new Date('2026-08-02T12:00:00Z'), 'in_progress');
    await seedEntry(completedId, benchPressId, 10, 60);
    await seedEntry(inProgressId, benchPressId, 8, 60, false); // not completed

    const rows = await repo.getExerciseHistory(userId, benchPressId, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].reps).toBe(10);
  });

  it('filters by exerciseId (excludes other exercises)', async () => {
    const wid = await seedCompletedWorkout(userId, new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid, benchPressId, 10, 60);
    await seedEntry(wid, squatId, 5, 100);

    const rows = await repo.getExerciseHistory(userId, benchPressId, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].weight).toBe(60);
  });

  it('filters by userId (excludes other users)', async () => {
    const mineId = await seedCompletedWorkout(userId, new Date('2026-08-01T12:00:00Z'));
    const otherId = await seedCompletedWorkout(otherUserId, new Date('2026-08-02T12:00:00Z'));
    await seedEntry(mineId, benchPressId, 10, 60);
    await seedEntry(otherId, benchPressId, 12, 80);

    const rows = await repo.getExerciseHistory(userId, benchPressId, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].reps).toBe(10);
  });

  it('filters by since (excludes entries before the cutoff)', async () => {
    const wid1 = await seedCompletedWorkout(userId, new Date('2026-07-25T12:00:00Z'));
    const wid2 = await seedCompletedWorkout(userId, new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid1, benchPressId, 10, 50);
    await seedEntry(wid2, benchPressId, 10, 60);

    const since = new Date('2026-08-01T00:00:00Z');
    const rows = await repo.getExerciseHistory(userId, benchPressId, since);
    expect(rows).toHaveLength(1);
    expect(rows[0].weight).toBe(60);
  });

  it('returns all entries when since is null', async () => {
    const wid1 = await seedCompletedWorkout(userId, new Date('2026-07-25T12:00:00Z'));
    const wid2 = await seedCompletedWorkout(userId, new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid1, benchPressId, 10, 50);
    await seedEntry(wid2, benchPressId, 10, 60);

    const rows = await repo.getExerciseHistory(userId, benchPressId, null);
    expect(rows).toHaveLength(2);
  });

  it('orders entries by workoutDate ASC (oldest first)', async () => {
    const wid1 = await seedCompletedWorkout(userId, new Date('2026-08-02T12:00:00Z'));
    const wid2 = await seedCompletedWorkout(userId, new Date('2026-07-25T12:00:00Z'));
    const wid3 = await seedCompletedWorkout(userId, new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid1, benchPressId, 1, 70);
    await seedEntry(wid2, benchPressId, 1, 50);
    await seedEntry(wid3, benchPressId, 1, 60);

    const rows = await repo.getExerciseHistory(userId, benchPressId, null);
    expect(rows[0].weight).toBe(50); // 2026-07-25
    expect(rows[1].weight).toBe(60); // 2026-08-01
    expect(rows[2].weight).toBe(70); // 2026-08-02
  });

  it('only includes entries with completed=true (excludes uncompleted sets)', async () => {
    const wid = await seedCompletedWorkout(userId, new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid, benchPressId, 10, 60, true);
    await seedEntry(wid, benchPressId, 8, 60, false); // not completed

    const rows = await repo.getExerciseHistory(userId, benchPressId, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].reps).toBe(10);
  });
});

// ============================================================================
// getCalendarData
// ============================================================================

/** Today at 12:00 UTC — keeps the date key stable regardless of timezone. */
function todayNoonUtc(): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD key in UTC (matches `toDateKey` in the repo). */
function toDateKeyUtc(d: Date): string {
  return d.toISOString().split('T')[0];
}

describe('SqliteProgressRepository — getCalendarData', () => {
  it('returns exactly N days', async () => {
    const days = await repo.getCalendarData(userId, 7);
    expect(days).toHaveLength(7);
  });

  it('marks hasWorkout=true for days with completed workouts', async () => {
    const targetDate = todayNoonUtc();
    const targetKey = toDateKeyUtc(targetDate);
    await seedCompletedWorkout(userId, targetDate, 'completed');
    const days = await repo.getCalendarData(userId, 7);
    const today = days.find((d) => d.date === targetKey);
    expect(today?.hasWorkout).toBe(true);
  });

  it('marks hasWorkout=false for days without workouts', async () => {
    const days = await repo.getCalendarData(userId, 7);
    const anyFalse = days.some((d) => d.hasWorkout === false);
    expect(anyFalse).toBe(true);
  });

  it('excludes in_progress workouts from hasWorkout', async () => {
    const targetDate = todayNoonUtc();
    const targetKey = toDateKeyUtc(targetDate);
    await seedCompletedWorkout(userId, targetDate, 'in_progress');
    const days = await repo.getCalendarData(userId, 7);
    const today = days.find((d) => d.date === targetKey);
    expect(today?.hasWorkout).toBe(false);
  });

  it('returns dates in YYYY-MM-DD format', async () => {
    const days = await repo.getCalendarData(userId, 3);
    for (const d of days) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('returns the most recent N days ending today', async () => {
    const days = await repo.getCalendarData(userId, 3);
    // The last entry should be today (UTC). Allow 1 day of slack for tz.
    const lastDate = new Date(days[days.length - 1].date + 'T00:00:00Z');
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / 86400000);
    expect(Math.abs(diffDays)).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// getStreak
// ============================================================================

describe('SqliteProgressRepository — getStreak', () => {
  it('returns current=0, total=0 when user has no workouts', async () => {
    const streak = await repo.getStreak(userId);
    expect(streak.current).toBe(0);
    expect(streak.total).toBe(0);
  });

  it('returns total = count of completed workouts', async () => {
    await seedCompletedWorkout(userId, new Date('2026-07-25T12:00:00Z'), 'completed');
    await seedCompletedWorkout(userId, new Date('2026-07-26T12:00:00Z'), 'completed');
    await seedCompletedWorkout(userId, new Date('2026-08-01T12:00:00Z'), 'in_progress');
    const streak = await repo.getStreak(userId);
    expect(streak.total).toBe(2); // in_progress excluded
  });

  it('returns current=0 when user has no workouts', async () => {
    const streak = await repo.getStreak(userId);
    expect(streak.current).toBe(0);
  });

  it('counts consecutive days ending today as current streak', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);
    await seedCompletedWorkout(userId, today, 'completed');
    await seedCompletedWorkout(userId, yesterday, 'completed');
    await seedCompletedWorkout(userId, twoDaysAgo, 'completed');
    const streak = await repo.getStreak(userId);
    expect(streak.current).toBe(3);
  });

  it('breaks streak when a day is missed', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);
    // Skip one day, then have a workout 2 days ago — that's a gap.
    const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
    await seedCompletedWorkout(userId, today, 'completed');
    await seedCompletedWorkout(userId, yesterday, 'completed');
    await seedCompletedWorkout(userId, threeDaysAgo, 'completed');
    const streak = await repo.getStreak(userId);
    expect(streak.current).toBe(2); // today + yesterday only
  });

  it('excludes other users from the count', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    await seedCompletedWorkout(userId, today, 'completed');
    await seedCompletedWorkout(otherUserId, today, 'completed');
    const streak = await repo.getStreak(userId);
    expect(streak.total).toBe(1);
  });
});
