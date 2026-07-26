// tests/workout-tracking/sqlite-workout.repository.test.ts
//
// AC-1.2-04: SqliteWorkoutRepository enforces write-own / read-all at
// the repository layer (no leaks across users) per ADR-004.
//
// Coverage:
//   - happy path: create, findById, findByUserAndDate, addEntry
//   - non-owner rejection: findById (allowed, read-all), update (rejected),
//     delete (rejected), addEntry on someone else's workout (rejected)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  SqliteWorkoutRepository,
} from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import {
  WorkoutOwnershipError,
  type WorkoutRepository,
} from '@/lib/contexts/workout-tracking/domain/workout.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { profiles, workouts, exercises, routineDays } from '@db/schema';

let handle: TestDbHandle;
let repo: WorkoutRepository;
let ownerId: string;
let otherId: string;
let routineDayId: string;
let exerciseId: string;
let workoutId: string;

beforeAll(async () => {
  handle = createTestDb();
  repo = new SqliteWorkoutRepository(handle.db);

  // Seed minimum: two profiles, one routine_day, one exercise.
  const [owner] = await handle.db
    .insert(profiles)
    .values({ displayName: 'Owner', routineType: 'hombre', weightUnit: 'kg' })
    .returning();
  const [other] = await handle.db
    .insert(profiles)
    .values({ displayName: 'Other', routineType: 'mujer', weightUnit: 'kg' })
    .returning();
  ownerId = owner.id;
  otherId = other.id;

  // routine_day needs a parent routine; seed inline.
  const { routines, routineDays } = await import('@db/schema');
  const [routine] = await handle.db
    .insert(routines)
    .values({ name: 'Test', type: 'hombre' })
    .returning();
  const [day] = await handle.db
    .insert(routineDays)
    .values({ routineId: routine.id, dayNumber: 1, dayName: 'Mon', focus: 'Test' })
    .returning();
  routineDayId = day.id;

  const [ex] = await handle.db
    .insert(exercises)
    .values({ name: 'Test Exercise', muscleGroup: 'chest' })
    .returning();
  exerciseId = ex.id;

  // Create a workout owned by `ownerId`.
  const w = await repo.create({
    userId: ownerId,
    routineDayId,
    workoutDate: new Date('2026-07-26T12:00:00Z'),
    status: 'in_progress',
  });
  workoutId = w.id;
});

afterAll(() => {
  handle.close();
});

describe('SqliteWorkoutRepository — happy path', () => {
  it('create() persists and returns the workout with defaults', async () => {
    const found = await repo.findById(workoutId);
    expect(found).toBeDefined();
    expect(found?.userId).toBe(ownerId);
    expect(found?.status).toBe('in_progress');
    expect(found?.startedAt).toBeInstanceOf(Date);
  });

  it('findByUserAndDate() returns the workout for the owner on that date', async () => {
    const found = await repo.findByUserAndDate(
      ownerId,
      new Date('2026-07-26T15:00:00Z'),
    );
    expect(found?.id).toBe(workoutId);
  });

  it('findByUserAndDate() returns undefined for a different date', async () => {
    const found = await repo.findByUserAndDate(
      ownerId,
      new Date('2026-07-27T12:00:00Z'),
    );
    expect(found).toBeUndefined();
  });

  it('findInProgressByUser() returns the in-progress workout', async () => {
    const found = await repo.findInProgressByUser(ownerId);
    expect(found?.id).toBe(workoutId);
  });

  it('addEntry() appends a workout_entry to the owner\'s workout', async () => {
    const entry = await repo.addEntry(
      workoutId,
      {
        workoutId,
        exerciseId,
        setNumber: 1,
        reps: 10,
        weight: 60,
        completed: true,
      },
      ownerId,
    );
    expect(entry.id).toBeTypeOf('string');
    expect(entry.workoutId).toBe(workoutId);
    expect(entry.weight).toBe(60);
  });

  it('findEntries() returns entries ordered by (exercise, set)', async () => {
    const entries = await repo.findEntries(workoutId);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].setNumber).toBe(1);
  });

  it('update() by the owner mutates the status', async () => {
    const updated = await repo.update(
      workoutId,
      { status: 'completed', completedAt: new Date() },
      ownerId,
    );
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeInstanceOf(Date);
  });
});

describe('SqliteWorkoutRepository — visibility / ownership (ADR-004)', () => {
  it('findById() is read-all — a non-owner CAN read someone else\'s workout', async () => {
    // Per ADR-004, all users can read all workouts (family feature).
    const found = await repo.findById(workoutId);
    expect(found?.id).toBe(workoutId);
    // (No ownership check on read path — by design.)
    expect(found?.userId).toBe(ownerId);
  });

  it('update() by a non-owner throws WorkoutOwnershipError', async () => {
    await expect(
      repo.update(workoutId, { status: 'in_progress' }, otherId),
    ).rejects.toBeInstanceOf(WorkoutOwnershipError);
  });

  it('delete() by a non-owner throws WorkoutOwnershipError', async () => {
    await expect(repo.delete(workoutId, otherId)).rejects.toBeInstanceOf(
      WorkoutOwnershipError,
    );
  });

  it('addEntry() by a non-owner throws WorkoutOwnershipError', async () => {
    await expect(
      repo.addEntry(
        workoutId,
        {
          workoutId,
          exerciseId,
          setNumber: 99,
          reps: 1,
          weight: 0,
          completed: false,
        },
        otherId,
      ),
    ).rejects.toBeInstanceOf(WorkoutOwnershipError);
  });

  it('update() throws when the workout does not exist', async () => {
    await expect(
      repo.update('does-not-exist', { status: 'completed' }, ownerId),
    ).rejects.toThrow(/not found/i);
  });

  it('delete() throws when the workout does not exist', async () => {
    await expect(repo.delete('does-not-exist', ownerId)).rejects.toThrow(
      /not found/i,
    );
  });

  it('after a failed non-owner delete, the row still exists', async () => {
    // Sanity: the failed delete in the test above must NOT have
    // accidentally removed the workout.
    const stillThere = await handle.db
      .select()
      .from(workouts)
      .where(eq(workouts.id, workoutId))
      .limit(1);
    expect(stillThere).toHaveLength(1);
  });
});
