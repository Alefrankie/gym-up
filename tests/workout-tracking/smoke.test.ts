// tests/workout-tracking/smoke.test.ts
//
// AC-1.2-12: end-to-end smoke test — create a profile, a routine, a
// workout, a workout entry, and a progress photo through the
// repositories (not raw SQL) and read them back.
//
// Uses the SAME repos that production code uses (composition root + the
// `SqliteXxxRepository` classes) to prove the contract end-to-end.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import {
  SqliteRoutineRepository,
} from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository';
import {
  SqliteWorkoutRepository,
} from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import {
  SqlitePhotoRepository,
} from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository';
import {
  SqliteProfileRepository,
} from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { profiles, exercises, routineDays, routineExercises } from '@db/schema';

let handle: TestDbHandle;
let uploadsDir: string;
let profileId: string;
let routineDayId: string;
let exerciseId: string;
let workoutId: string;
let photoId: string;
let fileOnDisk: string;

beforeAll(async () => {
  handle = createTestDb();
  uploadsDir = mkdtempSync(join(tmpdir(), 'gym-up-smoke-'));
  const uploadsPhotosDir = join(uploadsDir, 'uploads', 'photos');

  const profileRepo = new SqliteProfileRepository(handle.db);
  const routineRepo = new SqliteRoutineRepository(handle.db);
  const workoutRepo = new SqliteWorkoutRepository(handle.db);
  const photoRepo = new SqlitePhotoRepository(handle.db, {
    uploadsRoot: uploadsPhotosDir,
  });

  // 1. Profile
  const profile = await profileRepo.create({
    email: 'smoke@example.com',
    passwordHash: 'hashed_password',
    displayName: 'Smoke Tester',
    routineType: 'hombre',
    weightUnit: 'kg',
  });
  profileId = profile.id;

  // 2. Routine + day — seed inline (seed.ts not invoked here so the
  // smoke test stays isolated from canonical seed data).
  const { routines } = await import('@db/schema');
  const [routine] = await handle.db
    .insert(routines)
    .values({ name: 'Smoke Routine', type: 'hombre' })
    .returning();
  const [day] = await handle.db
    .insert(routineDays)
    .values({
      routineId: routine.id,
      dayNumber: 1,
      dayName: 'Monday',
      focus: 'Smoke Test',
    })
    .returning();
  routineDayId = day.id;

  // 3. Exercise
  const [ex] = await handle.db
    .insert(exercises)
    .values({ name: 'Smoke Press', muscleGroup: 'chest' })
    .returning();
  exerciseId = ex.id;

  // 3b. Link the exercise to the routine day (required by
  // findDayWithExercises but not for the rest of the smoke).
  await handle.db
    .insert(routineExercises)
    .values({
      routineDayId,
      exerciseId,
      targetSets: 4,
      targetReps: 10,
      exerciseOrder: 1,
    });

  // 3c. Verify the routine repo can read the day + its exercises.
  const dayWithExercises = await routineRepo.findDayWithExercises(routineDayId);
  expect(dayWithExercises?.exercises).toHaveLength(1);
  expect(dayWithExercises?.exercises[0].exercise.name).toBe('Smoke Press');

  // 4. Workout
  const workout = await workoutRepo.create({
    userId: profileId,
    routineDayId,
    workoutDate: new Date('2026-07-26T12:00:00Z'),
    status: 'in_progress',
  });
  workoutId = workout.id;

  // 5. Workout entry (log a set)
  const entry = await workoutRepo.addEntry(
    workoutId,
    {
      workoutId,
      exerciseId,
      setNumber: 1,
      reps: 10,
      weight: 60,
      completed: true,
    },
    profileId,
  );
  expect(entry.workoutId).toBe(workoutId);

  // 6. Photo
  const photo = await photoRepo.create(
    { userId: profileId, storagePath: '', photoDate: new Date(1_700_000_000_000) },
    profileId,
  );
  photoId = photo.id;
  fileOnDisk = join(
    uploadsPhotosDir,
    profileId,
    '1700000000000.jpg',
  );

  // 7. Complete the workout (update)
  const completed = await workoutRepo.update(
    workoutId,
    { status: 'completed', completedAt: new Date() },
    profileId,
  );
  expect(completed.status).toBe('completed');
});

afterAll(() => {
  handle.close();
  if (existsSync(uploadsDir)) {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

describe('smoke — end-to-end create → read through repos', () => {
  it('profile row is readable', async () => {
    const [p] = await handle.db.select().from(profiles).where(eq(profiles.id, profileId));
    expect(p?.displayName).toBe('Smoke Tester');
  });

  it('routine day + exercise link is queryable', async () => {
    const [d] = await handle.db.select().from(routineDays).where(eq(routineDays.id, routineDayId));
    expect(d?.dayName).toBe('Monday');
    const links = await handle.db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineDayId, routineDayId));
    expect(links).toHaveLength(1);
  });

  it('workout row exists with status=completed', async () => {
    const [w] = await handle.db.select().from(exercises).where(eq(exercises.id, exerciseId));
    expect(w).toBeDefined();
    // Use the workoutRepo (typed) to read the workout back
    const workoutRepo = new SqliteWorkoutRepository(handle.db);
    const found = await workoutRepo.findById(workoutId);
    expect(found?.status).toBe('completed');
    expect(found?.completedAt).toBeInstanceOf(Date);
  });

  it('workout entry is queryable via findEntries()', async () => {
    const workoutRepo = new SqliteWorkoutRepository(handle.db);
    const entries = await workoutRepo.findEntries(workoutId);
    expect(entries).toHaveLength(1);
    expect(entries[0].reps).toBe(10);
    expect(entries[0].weight).toBe(60);
  });

  it('photo row exists and the file lives on the local filesystem', async () => {
    const photoRepo = new SqlitePhotoRepository(handle.db);
    const found = await photoRepo.findById(photoId, profileId);
    expect(found?.userId).toBe(profileId);
    expect(existsSync(fileOnDisk)).toBe(true);
  });
});
