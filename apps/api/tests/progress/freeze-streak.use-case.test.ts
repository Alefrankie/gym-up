// tests/progress/freeze-streak.use-case.test.ts
//
// Use case: freeze yesterday's missed training day (DR-0032).
// Real SQLite repo; the clock is pinned so "yesterday" and the ISO week are known.
// No active program here, so every weekday is a planned training day.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/calculate-streak.use-case';
import {
  FreezeStreakUseCase,
  StreakFreezeNotAllowedError,
} from '@/lib/contexts/progress/application/freeze-streak.use-case';
import { SqliteProgressRepository } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { profiles, routineDays, routines, streakFreezes, workouts } from '@db/schema';

let handle: TestDbHandle;
let freeze: FreezeStreakUseCase;
let streak: CalculateStreakUseCase;
let userId: string;
let routineDayId: string;

beforeAll(async () => {
  handle = createTestDb();
  const repo = new SqliteProgressRepository(handle.db);
  freeze = new FreezeStreakUseCase(repo);
  streak = new CalculateStreakUseCase(repo);

  const [u] = await handle.db
    .insert(profiles)
    .values({ email: 'fz@example.com', passwordHash: 'h', displayName: 'U', routineType: 'hombre', weightUnit: 'kg' })
    .returning();
  userId = u.id;
  const [r] = await handle.db.insert(routines).values({ name: 'T', type: 'hombre' }).returning();
  const [d] = await handle.db
    .insert(routineDays)
    .values({ routineId: r.id, dayNumber: 1, dayName: 'M', focus: 'C' })
    .returning();
  routineDayId = d.id;
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(workouts);
  await handle.db.delete(streakFreezes);
});

afterEach(() => vi.useRealTimers());

/** Pin "now" to noon UTC of the given day. */
function setToday(day: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${day}T12:00:00Z`));
}

async function seedWorkout(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  await handle.db
    .insert(workouts)
    .values({ userId, routineDayId, workoutDate: date, status: 'completed', startedAt: date, completedAt: date });
}

describe('FreezeStreakUseCase', () => {
  it('freezes a missed yesterday so training today keeps the streak', async () => {
    // Sat 7 + Sun 8 trained, Mon 9 missed, today Tue 10.
    await seedWorkout('2026-11-07');
    await seedWorkout('2026-11-08');
    setToday('2026-11-10');

    const before = await streak.execute({ userId });
    expect(before.current).toBe(0);
    expect(before.canFreeze).toBe(true);

    const after = await freeze.execute({ userId });
    expect(after.current).toBe(2); // frozen day is neutral: it does not count
    expect(after.frozenDays).toEqual(['2026-11-09']);
    expect(after.canFreeze).toBe(false);

    await seedWorkout('2026-11-10');
    const trained = await streak.execute({ userId });
    expect(trained.current).toBe(3);
    expect(trained.total).toBe(3); // a freeze is not a workout
  });

  it('allows only one freeze per ISO week', async () => {
    await seedWorkout('2026-11-08');
    setToday('2026-11-10');
    await freeze.execute({ userId }); // freezes Mon 9
    await seedWorkout('2026-11-10');
    await seedWorkout('2026-11-11');

    // Thu 12 missed, today Fri 13: same week as Mon 9.
    setToday('2026-11-13');
    await expect(freeze.execute({ userId })).rejects.toBeInstanceOf(StreakFreezeNotAllowedError);

    // Next week: Mon 16 missed after training Fri 13 → Sun 15.
    await seedWorkout('2026-11-13');
    await seedWorkout('2026-11-14');
    await seedWorkout('2026-11-15');
    setToday('2026-11-17');
    const next = await freeze.execute({ userId });
    expect(next.frozenDays).toEqual(['2026-11-09', '2026-11-16']);
  });

  it('refuses when yesterday has a workout', async () => {
    await seedWorkout('2026-11-09');
    setToday('2026-11-10');
    await expect(freeze.execute({ userId })).rejects.toBeInstanceOf(StreakFreezeNotAllowedError);
  });

  it('refuses when there is no streak to save', async () => {
    await seedWorkout('2026-11-01');
    setToday('2026-11-10');
    expect((await streak.execute({ userId })).canFreeze).toBe(false);
    await expect(freeze.execute({ userId })).rejects.toBeInstanceOf(StreakFreezeNotAllowedError);
  });
});
