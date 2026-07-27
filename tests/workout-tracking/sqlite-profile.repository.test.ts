// tests/workout-tracking/sqlite-profile.repository.test.ts
//
// AC-1.1-06: SqliteProfileRepository compiles and is wired via the
// per-context composition. This test exercises its public API end-to-end
// against an in-memory SQLite database.
//
// Fixture migration (golden-rules: Test Fixtures):
//   - Story 1.1: single-table fixture (profiles only).
//   - Story 1.2: expanded to all 8 canonical tables (contract drift fix).
//   - Assertions unchanged.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SqliteProfileRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository';
import type { ProfileRepository } from '@/lib/contexts/workout-tracking/domain/profile.repository';
import { createTestDb, type TestDbHandle } from './test-db';

let handle: TestDbHandle;
let repo: ProfileRepository;

beforeAll(() => {
  handle = createTestDb();
  repo = new SqliteProfileRepository(handle.db);
});

afterAll(() => {
  handle.close();
});

describe('SqliteProfileRepository', () => {
  it('create() persists and returns a profile', async () => {
    const created = await repo.create({
      email: 'ada@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Ada',
      routineType: 'mujer',
      weightUnit: 'kg',
    });
    expect(created.id).toBeTypeOf('string');
    expect(created.displayName).toBe('Ada');
    expect(created.routineType).toBe('mujer');
    expect(created.weightUnit).toBe('kg');
  });

  it('findById() returns the persisted profile', async () => {
    const created = await repo.create({
      email: 'linus@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Linus',
      routineType: 'hombre',
      weightUnit: 'lbs',
    });
    const found = await repo.findById(created.id);
    expect(found?.displayName).toBe('Linus');
  });

  it('findById() returns undefined for an unknown id', async () => {
    const found = await repo.findById('does-not-exist');
    expect(found).toBeUndefined();
  });

  it('update() mutates the requested fields and returns the updated row', async () => {
    const created = await repo.create({
      email: 'grace@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Grace',
      routineType: 'hombre',
      weightUnit: 'kg',
    });
    const updated = await repo.update(created.id, { weightUnit: 'lbs' });
    expect(updated.weightUnit).toBe('lbs');
    expect(updated.displayName).toBe('Grace'); // unchanged
  });

  it('update() throws when the profile does not exist', async () => {
    await expect(
      repo.update('does-not-exist', { weightUnit: 'lbs' }),
    ).rejects.toThrow(/not found/i);
  });

  it('findByEmail() returns the profile by email', async () => {
    const created = await repo.create({
      email: 'findme@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Find Me',
      routineType: 'hombre',
      weightUnit: 'kg',
    });
    const found = await repo.findByEmail('findme@example.com');
    expect(found?.id).toBe(created.id);
  });
});
