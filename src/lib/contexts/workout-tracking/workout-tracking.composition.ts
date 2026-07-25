// src/lib/contexts/workout-tracking/workout-tracking.composition.ts
//
// Per-context composition root (ADR-010).
// Reads `STORAGE_BACKEND` and wires the matching concrete impl.
// No central container — each context owns its own wiring.

import { db } from '@/lib/db/client';
import { ProfileRepository } from './domain/profile.repository';
import { SqliteProfileRepository } from './infrastructure/sqlite/sqlite-profile.repository';

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

const backend = resolveStorageBackend();

export const profileRepository: ProfileRepository = buildProfileRepository(backend);
export const workoutTrackingBackend = backend;
