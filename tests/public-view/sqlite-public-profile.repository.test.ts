// tests/public-view/sqlite-public-profile.repository.test.ts
//
// Repository: SqlitePublicProfileRepository
// Tests getAll() and getById() against in-memory SQLite.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SqlitePublicProfileRepository } from '@/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-profile.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { profiles } from '@db/schema';

let handle: TestDbHandle;
let repo: SqlitePublicProfileRepository;

beforeAll(() => {
  handle = createTestDb();
  repo = new SqlitePublicProfileRepository(handle.db);
});

afterAll(() => handle.close());

beforeEach(async () => {
  await handle.db.delete(profiles);
});

describe('SqlitePublicProfileRepository', () => {
  describe('getAll', () => {
    it('returns empty array when no profiles exist', async () => {
      const result = await repo.getAll();
      expect(result).toEqual([]);
    });

    it('returns all profiles with id, displayName, routineType', async () => {
      await handle.db.insert(profiles).values([
        {
          email: 'a@test.com',
          passwordHash: 'h',
          displayName: 'Alice',
          routineType: 'hombre',
          weightUnit: 'kg',
        },
        {
          email: 'b@test.com',
          passwordHash: 'h',
          displayName: 'Bob',
          routineType: 'mujer',
          weightUnit: 'lbs',
        },
      ]);

      const result = await repo.getAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: expect.any(String),
        displayName: 'Alice',
        routineType: 'hombre',
      });
      expect(result[1]).toMatchObject({
        id: expect.any(String),
        displayName: 'Bob',
        routineType: 'mujer',
      });
    });

    it('does NOT include email in results (FR-PV-003)', async () => {
      await handle.db.insert(profiles).values({
        email: 'secret@test.com',
        passwordHash: 'h',
        displayName: 'Private',
        routineType: 'hombre',
        weightUnit: 'kg',
      });

      const result = await repo.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('email');
      expect(result[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('getById', () => {
    it('returns undefined for non-existent ID', async () => {
      const result = await repo.getById('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('returns profile by ID', async () => {
      const [inserted] = await handle.db
        .insert(profiles)
        .values({
          email: 'find@test.com',
          passwordHash: 'h',
          displayName: 'Findable',
          routineType: 'mujer',
          weightUnit: 'kg',
        })
        .returning();

      const result = await repo.getById(inserted.id);

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        id: inserted.id,
        displayName: 'Findable',
        routineType: 'mujer',
      });
      expect(result).not.toHaveProperty('email');
    });
  });
});
