// tests/progress/get-calendar-data.use-case.test.ts
//
// Use case: passthrough to ProgressRepository.getCalendarData with default days.
// CalendarRules.DisplayDays = 28 is the default per architecture readme.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GetCalendarDataUseCase } from '@/lib/contexts/progress/application/get-calendar-data.use-case';
import { SqliteProgressRepository } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository';
import { CalendarRules } from '@/lib/contexts/progress/domain/progress.constants';
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
let useCase: GetCalendarDataUseCase;
let userId: string;
let routineDayId: string;
let benchId: string;

beforeAll(async () => {
  handle = createTestDb();
  const repo = new SqliteProgressRepository(handle.db);
  useCase = new GetCalendarDataUseCase(repo);

  const [u] = await handle.db
    .insert(profiles)
    .values({
      email: 'gcd@example.com',
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

describe('GetCalendarDataUseCase', () => {
  it('uses CalendarRules.DisplayDays (28) as default', async () => {
    const result = await useCase.execute({ userId });
    expect(result).toHaveLength(CalendarRules.DisplayDays);
  });

  it('accepts custom days', async () => {
    const result = await useCase.execute({ userId, days: 7 });
    expect(result).toHaveLength(7);
  });

  it('marks hasWorkout=true for days with completed workouts', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    await seedEntry(await seedWorkout(today, 'completed'));
    const result = await useCase.execute({ userId, days: 3 });
    const todayKey = today.toISOString().split('T')[0];
    const todayEntry = result.find((d) => d.date === todayKey);
    expect(todayEntry?.hasWorkout).toBe(true);
  });

  it('excludes in_progress workouts from hasWorkout', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    await seedEntry(await seedWorkout(today, 'in_progress'));
    const result = await useCase.execute({ userId, days: 3 });
    const todayKey = today.toISOString().split('T')[0];
    const todayEntry = result.find((d) => d.date === todayKey);
    expect(todayEntry?.hasWorkout).toBe(false);
  });

  it('returns YYYY-MM-DD format dates', async () => {
    const result = await useCase.execute({ userId, days: 3 });
    for (const d of result) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
