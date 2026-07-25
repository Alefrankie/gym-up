// tests/workout-tracking/sqlite-profile.repository.test.ts
//
// AC-1.1-06: SqliteProfileRepository compiles and is wired via the
// per-context composition. This test exercises its public API end-to-end
// against an in-memory SQLite database.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { profiles } from '@db/schema';
import { SqliteProfileRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository';
import type { ProfileRepository } from '@/lib/contexts/workout-tracking/domain/profile.repository';

let sqlite: Database.Database;
let db: BetterSQLite3Database<{ profiles: typeof profiles }>;
let repo: ProfileRepository;

beforeAll(() => {
  sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      routine_type TEXT NOT NULL,
      weight_unit TEXT NOT NULL DEFAULT 'kg',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  db = drizzle(sqlite, { schema: { profiles } });
  repo = new SqliteProfileRepository(db);
});

afterAll(() => {
  sqlite.close();
});

describe('SqliteProfileRepository', () => {
  it('create() persists and returns a profile', async () => {
    const created = await repo.create({
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

  it('findByEmail() returns undefined in Round 1 (email column lands in 1.3)', async () => {
    const found = await repo.findByEmail('anyone@example.com');
    expect(found).toBeUndefined();
  });
});
