// tests/workout-tracking/sqlite-photo.repository.test.ts
//
// AC-1.2-05: SqlitePhotoRepository enforces owner-only access per ADR-005.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import {
  SqlitePhotoRepository,
} from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository';
import {
  PhotoOwnershipError,
  type PhotoRepository,
} from '@/lib/contexts/workout-tracking/domain/photo.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { profiles } from '@db/schema';

let handle: TestDbHandle;
let repo: PhotoRepository;
let ownerId: string;
let otherId: string;
let photoId: string;

beforeAll(async () => {
  handle = createTestDb();
  repo = new SqlitePhotoRepository(handle.db);

  const [owner] = await handle.db
    .insert(profiles)
    .values({ 
      email: 'owner@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Owner', 
      routineType: 'hombre', 
      weightUnit: 'kg' 
    })
    .returning();
  const [other] = await handle.db
    .insert(profiles)
    .values({ 
      email: 'other@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Other', 
      routineType: 'mujer', 
      weightUnit: 'kg' 
    })
    .returning();
  ownerId = owner.id;
  otherId = other.id;

  const created = await repo.create(
    { userId: ownerId, storagePath: '', photoDate: new Date(1_700_000_000_000) },
    ownerId,
  );
  photoId = created.id;
});

afterAll(() => {
  handle.close();
});

describe('SqlitePhotoRepository — happy path', () => {
  it('create() persists a row with the object key (no filesystem involved)', async () => {
    const found = await repo.findById(photoId, ownerId);
    expect(found).toBeDefined();
    expect(found?.userId).toBe(ownerId);
    // The object key is derived from the user + timestamp: photos/{userId}/{timestamp}.jpg
    expect(found?.storagePath).toBe(`photos/${ownerId}/1700000000000.jpg`);
  });

  it('findByUser() returns only the owner\'s photos, newest first', async () => {
    const all = await repo.findByUser(ownerId);
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.every((p) => p.userId === ownerId)).toBe(true);
  });

  it('create() rejects when input.userId mismatches currentUserId', async () => {
    await expect(
      repo.create(
        { userId: otherId, storagePath: '', photoDate: new Date() },
        ownerId,
      ),
    ).rejects.toBeInstanceOf(PhotoOwnershipError);
  });
});

describe('SqlitePhotoRepository — owner-only (ADR-005)', () => {
  it('findById() throws PhotoOwnershipError for a non-owner', async () => {
    await expect(repo.findById(photoId, otherId)).rejects.toBeInstanceOf(
      PhotoOwnershipError,
    );
  });

  it('findById() returns undefined for an unknown id', async () => {
    const found = await repo.findById('does-not-exist', ownerId);
    expect(found).toBeUndefined();
  });

  it('delete() by the owner removes the row', async () => {
    // First create a fresh photo to delete (don't delete the one
    // other tests use for findById).
    const fresh = await repo.create(
      { userId: ownerId, storagePath: '', photoDate: new Date(1_710_000_000_000) },
      ownerId,
    );
    await repo.delete(fresh.id, ownerId);
    const after = await repo.findById(fresh.id, ownerId);
    expect(after).toBeUndefined();
  });

  it('delete() throws PhotoOwnershipError for a non-owner', async () => {
    await expect(repo.delete(photoId, otherId)).rejects.toBeInstanceOf(
      PhotoOwnershipError,
    );
  });
});
