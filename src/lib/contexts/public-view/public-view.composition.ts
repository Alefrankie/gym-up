// src/lib/contexts/public-view/public-view.composition.ts
//
// Per-context composition root (ADR-010).
// Reads `STORAGE_BACKEND` and wires the matching concrete impl.
// No central container — each context owns its own wiring.
//
// Per golden-rules (Cross-Context Isolation): imports CalculateStreakUseCase
// from progress context via its public API (use case), NOT via repository.
// The public-view repos read directly from schema tables.

import { db } from '@/lib/db/client';
import { SqlitePublicProfileRepository } from './infrastructure/sqlite/sqlite-public-profile.repository';
import { SqlitePublicWorkoutRepository } from './infrastructure/sqlite/sqlite-public-workout.repository';
import { GetAllMembersUseCase } from './application/get-all-members.use-case';
import { CalculateMemberStatsUseCase } from './application/calculate-member-stats.use-case';
import { GetMemberDetailUseCase } from './application/get-member-detail-use-case';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/calculate-streak.use-case';
import { SqliteProgressRepository } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository';

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

const backend = resolveStorageBackend();

// ---------- Repositories ----------

function buildPublicProfileRepository(
  backend: StorageBackend,
): SqlitePublicProfileRepository {
  switch (backend) {
    case 'sqlite':
      return new SqlitePublicProfileRepository(db);
    case 'supabase':
      throw new Error(
        'STORAGE_BACKEND=supabase is not supported in Round 1. ' +
          'SupabasePublicProfileRepository lands in Round 6 (story 6.2).',
      );
  }
}

function buildPublicWorkoutRepository(
  backend: StorageBackend,
): SqlitePublicWorkoutRepository {
  switch (backend) {
    case 'sqlite':
      return new SqlitePublicWorkoutRepository(db);
    case 'supabase':
      throw new Error(
        'STORAGE_BACKEND=supabase is not supported in Round 1. ' +
          'SupabasePublicWorkoutRepository lands in Round 6 (story 6.2).',
      );
  }
}

function buildProgressRepositoryForStreak(
  backend: StorageBackend,
): SqliteProgressRepository {
  switch (backend) {
    case 'sqlite':
      return new SqliteProgressRepository(db);
    case 'supabase':
      throw new Error(
        'STORAGE_BACKEND=supabase is not supported in Round 1.',
      );
  }
}

// ---------- Wiring ----------

const profileRepo = buildPublicProfileRepository(backend);
const workoutRepo = buildPublicWorkoutRepository(backend);
const progressRepo = buildProgressRepositoryForStreak(backend);

const streakUseCase = new CalculateStreakUseCase(progressRepo);
const statsUseCase = new CalculateMemberStatsUseCase(workoutRepo, streakUseCase);

export const getAllMembersUseCase = new GetAllMembersUseCase(
  profileRepo,
  statsUseCase,
);

export const getMemberDetailUseCase = new GetMemberDetailUseCase(
  profileRepo,
  workoutRepo,
  statsUseCase,
);

export const publicViewBackend = backend;
