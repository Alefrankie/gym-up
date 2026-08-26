// src/lib/contexts/progress/progress.composition.ts
//
// Per-context composition root (ADR-010).
// Reads `STORAGE_BACKEND` and wires the matching concrete impl.
// No central container — each context owns its own wiring.

import { db } from '@/lib/db/client';
import { getSupabaseClient } from '@/lib/supabase/client';
import { SqliteProgressRepository } from './infrastructure/sqlite/sqlite-progress.repository';
import { SqliteExerciseQueryRepository } from './infrastructure/sqlite/sqlite-exercise-query.repository';
import { SupabaseProgressRepository } from './infrastructure/supabase/supabase-progress.repository';
import { SupabaseExerciseQueryRepository } from './infrastructure/supabase/supabase-exercise-query.repository';
import { ProgressRepository } from './domain/ports/ProgressRepository';
import { ExerciseQueryRepository } from './domain/ports/ExerciseQueryRepository';
import { GetExerciseListUseCase } from './application/get-exercise-list.use-case';
import { GetExerciseHistoryUseCase } from './application/get-exercise-history.use-case';
import { CalculateStreakUseCase } from './application/calculate-streak.use-case';
import { GetCalendarDataUseCase } from './application/get-calendar-data.use-case';

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

function buildProgressRepository(backend: StorageBackend): ProgressRepository {
  switch (backend) {
    case 'sqlite':
      return new SqliteProgressRepository(db);
    case 'supabase':
      return new SupabaseProgressRepository(getSupabaseClient());
  }
}

function buildExerciseQueryRepository(
  backend: StorageBackend,
): ExerciseQueryRepository {
  switch (backend) {
    case 'sqlite':
      return new SqliteExerciseQueryRepository(db);
    case 'supabase':
      return new SupabaseExerciseQueryRepository(getSupabaseClient());
  }
}

const backend = resolveStorageBackend();

const progressRepository = buildProgressRepository(backend);
const exerciseQueryRepository = buildExerciseQueryRepository(backend);

export const getExerciseListUseCase = new GetExerciseListUseCase(
  exerciseQueryRepository,
);
export const getExerciseHistoryUseCase = new GetExerciseHistoryUseCase(
  progressRepository,
);
export const calculateStreakUseCase = new CalculateStreakUseCase(
  progressRepository,
);
export const getCalendarDataUseCase = new GetCalendarDataUseCase(
  progressRepository,
);

export const progressBackend = backend;
