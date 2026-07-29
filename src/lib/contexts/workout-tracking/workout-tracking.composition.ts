// src/lib/contexts/workout-tracking/workout-tracking.composition.ts
//
// Per-context composition root (ADR-010).
// Reads `STORAGE_BACKEND` and wires the matching concrete impl.
// No central container — each context owns its own wiring.

import { db } from '@/lib/db/client';
import { ProfileRepository } from './domain/profile.repository';
import { RoutineRepository } from './domain/routine.repository';
import { WorkoutRepository } from './domain/workout.repository';
import { PhotoRepository } from './domain/photo.repository';
import { SqliteProfileRepository } from './infrastructure/sqlite/sqlite-profile.repository';
import { SqliteRoutineRepository } from './infrastructure/sqlite/sqlite-routine.repository';
import { SqliteWorkoutRepository } from './infrastructure/sqlite/sqlite-workout.repository';
import { SqlitePhotoRepository } from './infrastructure/sqlite/sqlite-photo.repository';
import { GetTodayWorkoutUseCase } from './application/get-today-workout.use-case';
import { StartWorkoutUseCase } from './application/start-workout.use-case';

type StorageBackend = 'sqlite' | 'supabase';

function resolveStorageBackend(): StorageBackend {
  const raw = (process.env.STORAGE_BACKEND ?? 'sqlite').toLowerCase();
  if (raw === 'sqlite' || raw === 'supabase') {
    return raw;
  }
  throw new Error(
    `Invalid STORAGE_BACKEND="${raw}". Expected 'sqlite' (Rounds 1-5) or 'supabase' (Round 6).`,
  );
}

function buildProfileRepository(backend: StorageBackend): ProfileRepository {
  switch (backend) {
    case 'sqlite':
      return new SqliteProfileRepository(db);
    case 'supabase':
      throw new Error(
        'STORAGE_BACKEND=supabase is not supported in Round 1. ' +
          'SupabaseXxxRepository lands in Round 6 (story 6.2).',
      );
  }
}

function buildRoutineRepository(backend: StorageBackend): RoutineRepository {
  switch (backend) {
    case 'sqlite':
      return new SqliteRoutineRepository(db);
    case 'supabase':
      throw new Error(
        'STORAGE_BACKEND=supabase is not supported in Round 1. ' +
          'SupabaseXxxRepository lands in Round 6 (story 6.2).',
      );
  }
}

function buildWorkoutRepository(backend: StorageBackend): WorkoutRepository {
  switch (backend) {
    case 'sqlite':
      return new SqliteWorkoutRepository(db);
    case 'supabase':
      throw new Error(
        'STORAGE_BACKEND=supabase is not supported in Round 1. ' +
          'SupabaseXxxRepository lands in Round 6 (story 6.2).',
      );
  }
}

function buildPhotoRepository(backend: StorageBackend): PhotoRepository {
  switch (backend) {
    case 'sqlite':
      return new SqlitePhotoRepository(db);
    case 'supabase':
      throw new Error(
        'STORAGE_BACKEND=supabase is not supported in Round 1. ' +
          'SupabaseXxxRepository lands in Round 6 (story 6.2).',
      );
  }
}

const backend = resolveStorageBackend();

export const profileRepository: ProfileRepository = buildProfileRepository(backend);
export const routineRepository: RoutineRepository = buildRoutineRepository(backend);
export const workoutRepository: WorkoutRepository = buildWorkoutRepository(backend);
export const photoRepository: PhotoRepository = buildPhotoRepository(backend);

// Use case singletons (stories 2.1 + 2.2). Follow the same composition-root
// pattern as the repositories above.
export const getTodayWorkoutUseCase: GetTodayWorkoutUseCase =
  new GetTodayWorkoutUseCase(routineRepository, workoutRepository);

export const startWorkoutUseCase: StartWorkoutUseCase =
  new StartWorkoutUseCase(routineRepository, workoutRepository);

export const workoutTrackingBackend = backend;
