// tests/workout-tracking/get-workout-history.use-case.test.ts
//
// AC-3.1-01: History shows all workouts per FR-PR-001
// AC-3.1-02: Paginated at 20 per page
//
// Covers GetWorkoutHistoryUseCase outcomes:
//   - empty history (zero workouts)
//   - single page (< 20 workouts)
//   - multiple pages (> 20 workouts, verify pagination metadata)
//   - order: newest first (DESC by workout_date)
//   - page defaults to 1 when undefined or < 1
//   - includes both in_progress and completed workouts (Q2 decision)
//   - only returns workouts for the requested user (not other users)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GetWorkoutHistoryUseCase } from '@/lib/contexts/workout-tracking/application/get-workout-history.use-case';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { profiles, routineDays, routines, workouts } from '@db/schema';

let handle: TestDbHandle;
let useCase: GetWorkoutHistoryUseCase;
let userId: string;
let otherUserId: string;
let routineDayId: string;

beforeAll(async () => {
  handle = createTestDb();
  const workoutRepo = new SqliteWorkoutRepository(handle.db);
  useCase = new GetWorkoutHistoryUseCase(workoutRepo);

  const [owner] = await handle.db
    .insert(profiles)
    .values({
      email: 'owner@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Owner',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = owner.id;

  const [other] = await handle.db
    .insert(profiles)
    .values({
      email: 'other@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Other',
      routineType: 'mujer',
      weightUnit: 'kg',
    })
    .returning();
  otherUserId = other.id;

  const [routine] = await handle.db
    .insert(routines)
    .values({ name: 'Test Routine', type: 'hombre' })
    .returning();
  const [day] = await handle.db
    .insert(routineDays)
    .values({ routineId: routine.id, dayNumber: 1, dayName: 'Monday', focus: 'Chest' })
    .returning();
  routineDayId = day.id;
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(workouts);
});

describe('GetWorkoutHistoryUseCase — empty history', () => {
  it('returns empty list when user has no workouts', async () => {
    const result = await useCase.execute({ userId });
    expect(result.items).toEqual([]);
    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(0);
  });
});

describe('GetWorkoutHistoryUseCase — single page', () => {
  it('returns all workouts when count < 20', async () => {
    // Create 3 workouts on different dates
    for (let i = 0; i < 3; i++) {
      await handle.db.insert(workouts).values({
        userId,
        routineDayId,
        workoutDate: new Date(`2026-07-${25 - i}T12:00:00Z`),
        status: 'completed',
        startedAt: new Date(`2026-07-${25 - i}T12:00:00Z`),
        completedAt: new Date(`2026-07-${25 - i}T13:00:00Z`),
      });
    }

    const result = await useCase.execute({ userId });
    expect(result.items).toHaveLength(3);
    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('orders workouts by date DESC (newest first)', async () => {
    // Create workouts in non-chronological order
    const dates = ['2026-07-20', '2026-07-25', '2026-07-22'];
    for (const date of dates) {
      await handle.db.insert(workouts).values({
        userId,
        routineDayId,
        workoutDate: new Date(`${date}T12:00:00Z`),
        status: 'completed',
        startedAt: new Date(`${date}T12:00:00Z`),
        completedAt: new Date(`${date}T13:00:00Z`),
      });
    }

    const result = await useCase.execute({ userId });
    expect(result.items[0].workoutDate).toBeInstanceOf(Date);
    expect(result.items[0].workoutDate.toISOString()).toContain('2026-07-25');
    expect(result.items[1].workoutDate.toISOString()).toContain('2026-07-22');
    expect(result.items[2].workoutDate.toISOString()).toContain('2026-07-20');
  });

  it('includes both in_progress and completed workouts (Q2 decision)', async () => {
    await handle.db.insert(workouts).values({
      userId,
      routineDayId,
      workoutDate: new Date('2026-07-25T12:00:00Z'),
      status: 'completed',
      startedAt: new Date('2026-07-25T12:00:00Z'),
      completedAt: new Date('2026-07-25T13:00:00Z'),
    });
    await handle.db.insert(workouts).values({
      userId,
      routineDayId,
      workoutDate: new Date('2026-07-26T12:00:00Z'),
      status: 'in_progress',
      startedAt: new Date('2026-07-26T12:00:00Z'),
      completedAt: null,
    });

    const result = await useCase.execute({ userId });
    expect(result.items).toHaveLength(2);
    expect(result.items.some((item) => item.status === 'completed')).toBe(true);
    expect(result.items.some((item) => item.status === 'in_progress')).toBe(true);
  });
});

describe('GetWorkoutHistoryUseCase — multiple pages', () => {
  it('paginates when count > 20', async () => {
    // Create 25 workouts
    for (let i = 0; i < 25; i++) {
      const day = String(i + 1).padStart(2, '0');
      await handle.db.insert(workouts).values({
        userId,
        routineDayId,
        workoutDate: new Date(`2026-06-${day}T12:00:00Z`),
        status: 'completed',
        startedAt: new Date(`2026-06-${day}T12:00:00Z`),
        completedAt: new Date(`2026-06-${day}T13:00:00Z`),
      });
    }

    const result = await useCase.execute({ userId, page: 1 });
    expect(result.items).toHaveLength(20);
    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(2);
  });

  it('returns second page with remaining 5 workouts', async () => {
    for (let i = 0; i < 25; i++) {
      const day = String(i + 1).padStart(2, '0');
      await handle.db.insert(workouts).values({
        userId,
        routineDayId,
        workoutDate: new Date(`2026-06-${day}T12:00:00Z`),
        status: 'completed',
        startedAt: new Date(`2026-06-${day}T12:00:00Z`),
        completedAt: new Date(`2026-06-${day}T13:00:00Z`),
      });
    }

    const result = await useCase.execute({ userId, page: 2 });
    expect(result.items).toHaveLength(5);
    expect(result.currentPage).toBe(2);
    expect(result.totalPages).toBe(2);
  });
});

describe('GetWorkoutHistoryUseCase — edge cases', () => {
  it('defaults page to 1 when undefined', async () => {
    await handle.db.insert(workouts).values({
      userId,
      routineDayId,
      workoutDate: new Date('2026-07-25T12:00:00Z'),
      status: 'completed',
      startedAt: new Date('2026-07-25T12:00:00Z'),
      completedAt: new Date('2026-07-25T13:00:00Z'),
    });

    const result = await useCase.execute({ userId });
    expect(result.currentPage).toBe(1);
  });

  it('defaults page to 1 when < 1', async () => {
    const result = await useCase.execute({ userId, page: 0 });
    expect(result.currentPage).toBe(1);
  });

  it('only returns workouts for the requested user (not other users)', async () => {
    await handle.db.insert(workouts).values({
      userId,
      routineDayId,
      workoutDate: new Date('2026-07-25T12:00:00Z'),
      status: 'completed',
      startedAt: new Date('2026-07-25T12:00:00Z'),
      completedAt: new Date('2026-07-25T13:00:00Z'),
    });
    await handle.db.insert(workouts).values({
      userId: otherUserId,
      routineDayId,
      workoutDate: new Date('2026-07-26T12:00:00Z'),
      status: 'completed',
      startedAt: new Date('2026-07-26T12:00:00Z'),
      completedAt: new Date('2026-07-26T13:00:00Z'),
    });

    const result = await useCase.execute({ userId });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].workoutDate.toISOString()).toContain('2026-07-25');
  });
});
