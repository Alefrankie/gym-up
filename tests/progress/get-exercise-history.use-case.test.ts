// tests/progress/get-exercise-history.use-case.test.ts
//
// Use case: fetch exercise history aggregated by calendar day.
// Per ADR-009: real impl against in-memory SQLite, no mocks.
//
// This is the meat of the story — the aggregation logic (max weight/day,
// sum volume/day = Σ(reps × weight), date filter) is tested here.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GetExerciseHistoryUseCase } from '@/lib/contexts/progress/application/get-exercise-history.use-case';
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
let useCase: GetExerciseHistoryUseCase;
let userId: string;
let routineDayId: string;
let benchId: string;

beforeAll(async () => {
  handle = createTestDb();
  const repo = new SqliteProgressRepository(handle.db);
  useCase = new GetExerciseHistoryUseCase(repo);

  const [u] = await handle.db
    .insert(profiles)
    .values({
      email: 'geh@example.com',
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

async function seedEntry(wid: string, exId: string, reps: number, weight: number, completed = true) {
  await handle.db.insert(workoutEntries).values({
    workoutId: wid,
    exerciseId: exId,
    setNumber: 1,
    reps,
    weight,
    completed,
  });
}

describe('GetExerciseHistoryUseCase — aggregation', () => {
  it('returns empty array when no entries', async () => {
    const result = await useCase.execute({ userId, exerciseId: benchId, range: 'all' });
    expect(result).toEqual([]);
  });

  it('aggregates a single entry into one data point', async () => {
    const wid = await seedWorkout(new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid, benchId, 10, 60);
    const result = await useCase.execute({ userId, exerciseId: benchId, range: 'all' });
    expect(result).toEqual([{ date: '2026-08-01', weight: 60, volume: 600 }]);
  });

  it('takes max weight per day', async () => {
    const wid = await seedWorkout(new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid, benchId, 10, 50);
    await seedEntry(wid, benchId, 8, 60);
    await seedEntry(wid, benchId, 6, 55);
    const result = await useCase.execute({ userId, exerciseId: benchId, range: 'all' });
    expect(result[0].weight).toBe(60); // max(50, 60, 55)
  });

  it('sums volume per day (reps × weight), NOT set_number × reps × weight', async () => {
    const wid = await seedWorkout(new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid, benchId, 10, 50);
    await seedEntry(wid, benchId, 8, 60);
    const result = await useCase.execute({ userId, exerciseId: benchId, range: 'all' });
    // 10*50 + 8*60 = 500 + 480 = 980 (NOT 1*500 + 2*480 = 1460)
    expect(result[0].volume).toBe(980);
  });

  it('groups entries by calendar day (UTC)', async () => {
    const wid1 = await seedWorkout(new Date('2026-08-01T01:00:00Z'));
    const wid2 = await seedWorkout(new Date('2026-08-01T23:00:00Z'));
    const wid3 = await seedWorkout(new Date('2026-08-02T12:00:00Z'));
    await seedEntry(wid1, benchId, 10, 50);
    await seedEntry(wid2, benchId, 8, 60);
    await seedEntry(wid3, benchId, 5, 70);

    const result = await useCase.execute({ userId, exerciseId: benchId, range: 'all' });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: '2026-08-01', weight: 60, volume: 980 });
    expect(result[1]).toEqual({ date: '2026-08-02', weight: 70, volume: 350 });
  });

  it('orders results by date ASC', async () => {
    const wid1 = await seedWorkout(new Date('2026-08-02T12:00:00Z'));
    const wid2 = await seedWorkout(new Date('2026-07-25T12:00:00Z'));
    const wid3 = await seedWorkout(new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid1, benchId, 1, 70);
    await seedEntry(wid2, benchId, 1, 50);
    await seedEntry(wid3, benchId, 1, 60);

    const result = await useCase.execute({ userId, exerciseId: benchId, range: 'all' });
    expect(result.map((p) => p.date)).toEqual(['2026-07-25', '2026-08-01', '2026-08-02']);
  });

  it('ignores uncompleted sets (completed=false)', async () => {
    const wid = await seedWorkout(new Date('2026-08-01T12:00:00Z'));
    await seedEntry(wid, benchId, 10, 50, true);
    await seedEntry(wid, benchId, 8, 60, false);
    const result = await useCase.execute({ userId, exerciseId: benchId, range: 'all' });
    expect(result[0].volume).toBe(500); // only the completed set
  });

  it('ignores in_progress workouts entirely', async () => {
    const wid = await seedWorkout(new Date('2026-08-01T12:00:00Z'), 'in_progress');
    await seedEntry(wid, benchId, 10, 50);
    const result = await useCase.execute({ userId, exerciseId: benchId, range: 'all' });
    expect(result).toEqual([]);
  });
});

// ============================================================================
// Date range filter
// ============================================================================

describe('GetExerciseHistoryUseCase — date range filter', () => {
  it('range=all returns all entries (no cutoff)', async () => {
    const wid1 = await seedWorkout(new Date('2026-01-01T12:00:00Z'));
    const wid2 = await seedWorkout(new Date('2026-08-04T12:00:00Z'));
    await seedEntry(wid1, benchId, 10, 50);
    await seedEntry(wid2, benchId, 10, 60);
    const result = await useCase.execute(
      { userId, exerciseId: benchId, range: 'all' },
      new Date('2026-08-04T12:00:00Z'),
    );
    expect(result).toHaveLength(2);
  });

  it('range=7d with now=2026-08-04 includes entries from 2026-07-29 to 2026-08-04 (7 calendar days)', async () => {
    // Inside range (7 days ending today inclusive)
    await seedEntry(await seedWorkout(new Date('2026-07-29T12:00:00Z')), benchId, 1, 50);
    await seedEntry(await seedWorkout(new Date('2026-08-01T12:00:00Z')), benchId, 1, 55);
    await seedEntry(await seedWorkout(new Date('2026-08-04T12:00:00Z')), benchId, 1, 60);
    // Outside range
    await seedEntry(await seedWorkout(new Date('2026-07-28T12:00:00Z')), benchId, 1, 40);
    await seedEntry(await seedWorkout(new Date('2026-06-01T12:00:00Z')), benchId, 1, 30);

    const result = await useCase.execute(
      { userId, exerciseId: benchId, range: '7d' },
      new Date('2026-08-04T12:00:00Z'),
    );
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.date)).toEqual(['2026-07-29', '2026-08-01', '2026-08-04']);
  });

  it('range=30d with now=2026-08-04 includes entries from 2026-07-06 to 2026-08-04', async () => {
    // Boundary: 2026-07-06 should be included
    await seedEntry(await seedWorkout(new Date('2026-07-06T00:00:00Z')), benchId, 1, 50);
    // Just outside: 2026-07-05 should be excluded
    await seedEntry(await seedWorkout(new Date('2026-07-05T23:59:59Z')), benchId, 1, 40);
    // Today
    await seedEntry(await seedWorkout(new Date('2026-08-04T12:00:00Z')), benchId, 1, 60);

    const result = await useCase.execute(
      { userId, exerciseId: benchId, range: '30d' },
      new Date('2026-08-04T12:00:00Z'),
    );
    expect(result).toHaveLength(2);
  });

  it('range=7d with no entries returns empty array', async () => {
    const result = await useCase.execute(
      { userId, exerciseId: benchId, range: '7d' },
      new Date('2026-08-04T12:00:00Z'),
    );
    expect(result).toEqual([]);
  });

  it('uses current date when `now` is not provided', async () => {
    // Insert an entry "today" (now-ish)
    const today = new Date();
    const wid = await seedWorkout(today);
    await seedEntry(wid, benchId, 10, 50);
    const result = await useCase.execute({ userId, exerciseId: benchId, range: '7d' });
    expect(result).toHaveLength(1);
  });
});
