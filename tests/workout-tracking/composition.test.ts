// tests/workout-tracking/composition.test.ts
//
// AC-1.1-05 + AC-1.1-06: per-context composition root wires the right
// concrete based on STORAGE_BACKEND.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadCompositionFresh() {
  // Invalidate the module cache so the import re-runs the env-reading code.
  vi.resetModules();
  return import(
    '../../src/lib/contexts/workout-tracking/workout-tracking.composition'
  );
}

describe('workout-tracking composition', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (
        key === 'STORAGE_BACKEND' ||
        key === 'DATABASE_URL' ||
        key === 'SUPABASE_URL' ||
        key === 'SUPABASE_ANON_KEY'
      ) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('exports a `profileRepository` instance when STORAGE_BACKEND=sqlite', async () => {
    process.env.DATABASE_URL = 'file::memory:';
    process.env.STORAGE_BACKEND = 'sqlite';
    const mod = await loadCompositionFresh();
    expect(mod.profileRepository).toBeDefined();
    expect(typeof mod.profileRepository.findById).toBe('function');
    expect(typeof mod.profileRepository.create).toBe('function');
  });

  it('exports Supabase-backed repositories when STORAGE_BACKEND=supabase (story 6.2)', async () => {
    process.env.DATABASE_URL = 'file::memory:';
    process.env.STORAGE_BACKEND = 'supabase';
    process.env.SUPABASE_URL = 'https://dummy.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'dummy-anon-key';
    const mod = await loadCompositionFresh();
    expect(mod.profileRepository).toBeDefined();
    expect(typeof mod.profileRepository.findById).toBe('function');
    expect(typeof mod.workoutRepository.findById).toBe('function');
    expect(typeof mod.routineRepository.findAll).toBe('function');
    expect(typeof mod.photoRepository.findById).toBe('function');
  });

  it('throws a clear error when STORAGE_BACKEND=supabase but Supabase env is missing', async () => {
    process.env.DATABASE_URL = 'file::memory:';
    process.env.STORAGE_BACKEND = 'supabase';
    // Empty strings (not deleted) so the .env loader does not re-populate
    // them from the real .env file — simulates missing credentials.
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_ANON_KEY = '';
    await expect(loadCompositionFresh()).rejects.toThrow(/SUPABASE_URL/);
  });

  it('throws a clear error when STORAGE_BACKEND is invalid', async () => {
    process.env.DATABASE_URL = 'file::memory:';
    process.env.STORAGE_BACKEND = 'mongo';
    await expect(loadCompositionFresh()).rejects.toThrow(/Invalid STORAGE_BACKEND/);
  });
});
