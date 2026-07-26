// tests/workout-tracking/cascade.test.ts
//
// Category 5 (Cascade/Orphan Data) self-QA for story 1.2.
//
// Verifies FK cascade behavior for the parent-child chains introduced
// in the 1.2 schema:
//   - workouts (parent) → workout_entries (child)
//   - routines (parent) → routine_days (grandchild) → routine_exercises (great-grandchild)
//
// Run against an in-memory SQLite with foreign_keys=ON (the same mode
// the production Drizzle client enables per `client.ts`).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDbHandle } from './test-db';
import {
  exercises,
  profiles,
  routines,
  routineDays,
  routineExercises,
  workoutEntries,
  workouts,
} from '@db/schema';

let handle: TestDbHandle;
let profileId: string;
let routineId: string;
let dayId: string;
let exerciseId: string;
let workoutId: string;

beforeAll(async () => {
  handle = createTestDb();

  const [p] = await handle.db
    .insert(profiles)
    .values({ displayName: 'Cascade Tester', routineType: 'hombre', weightUnit: 'kg' })
    .returning();
  profileId = p.id;

  const [r] = await handle.db
    .insert(routines)
    .values({ name: 'Cascade Routine', type: 'hombre' })
    .returning();
  routineId = r.id;

  const [d] = await handle.db
    .insert(routineDays)
    .values({ routineId, dayNumber: 1, dayName: 'Mon', focus: 'Test' })
    .returning();
  dayId = d.id;

  const [e] = await handle.db
    .insert(exercises)
    .values({ name: 'Cascade Press', muscleGroup: 'chest' })
    .returning();
  exerciseId = e.id;

  await handle.db.insert(routineExercises).values({
    routineDayId: dayId,
    exerciseId,
    targetSets: 4,
    targetReps: 10,
    exerciseOrder: 1,
  });

  const [w] = await handle.db
    .insert(workouts)
    .values({
      userId: profileId,
      routineDayId: dayId,
      workoutDate: new Date(),
      status: 'in_progress',
    })
    .returning();
  workoutId = w.id;

  await handle.db.insert(workoutEntries).values({
    workoutId,
    exerciseId,
    setNumber: 1,
    reps: 10,
    weight: 60,
    completed: true,
  });
});

afterAll(() => handle.close());

describe('Cascade FK — parent-child chains', () => {
  it('deleting a workout cascades to its workout_entries', async () => {
    await handle.db.delete(workouts).where(eq(workouts.id, workoutId));
    const remaining = await handle.db
      .select()
      .from(workoutEntries)
      .where(eq(workoutEntries.workoutId, workoutId));
    expect(remaining).toHaveLength(0);
  });

  it('deleting a routine cascades to its routine_days and routine_exercises', async () => {
    await handle.db.delete(routines).where(eq(routines.id, routineId));
    const days = await handle.db
      .select()
      .from(routineDays)
      .where(eq(routineDays.routineId, routineId));
    const slots = await handle.db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineDayId, dayId));
    expect(days).toHaveLength(0);
    expect(slots).toHaveLength(0);
  });

  it('deleting a profile cascades to its workouts and progress_photos', async () => {
    // Need a fresh profile + workout + photo because earlier tests
    // already deleted the original profile's children.
    const [p2] = await handle.db
      .insert(profiles)
      .values({ displayName: 'Cascade2', routineType: 'mujer', weightUnit: 'kg' })
      .returning();
    const [r2] = await handle.db
      .insert(routines)
      .values({ name: 'Cascade Routine 2', type: 'mujer' })
      .returning();
    const [d2] = await handle.db
      .insert(routineDays)
      .values({ routineId: r2.id, dayNumber: 1, dayName: 'Mon', focus: 'Test' })
      .returning();
    const [w2] = await handle.db
      .insert(workouts)
      .values({
        userId: p2.id,
        routineDayId: d2.id,
        workoutDate: new Date(),
        status: 'in_progress',
      })
      .returning();
    const { progressPhotos } = await import('@db/schema');
    await handle.db.insert(progressPhotos).values({
      userId: p2.id,
      storagePath: 'test.jpg',
      photoDate: new Date(),
    });

    await handle.db.delete(profiles).where(eq(profiles.id, p2.id));
    const leftoverWorkouts = await handle.db
      .select()
      .from(workouts)
      .where(eq(workouts.userId, p2.id));
    const leftoverPhotos = await handle.db
      .select()
      .from(progressPhotos)
      .where(eq(progressPhotos.userId, p2.id));
    expect(leftoverWorkouts).toHaveLength(0);
    expect(leftoverPhotos).toHaveLength(0);
  });
});
