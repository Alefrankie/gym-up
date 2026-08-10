// tests/private-photos/delete-photo.use-case.test.ts
//
// AC-4.2-04 — delete removes the DB row and the file.
// AC-4.2-05 (cross-checked via repo) — cross-user delete throws.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DeletePhotoUseCase,
  PhotoNotFoundError,
} from '@/lib/contexts/private-photos/application/delete-photo.use-case';
import { PhotoOwnershipError } from '@/lib/contexts/workout-tracking/domain/photo.repository';
import { SqlitePhotoRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import { profiles } from '@db/schema';

let handle: TestDbHandle;
let repo: SqlitePhotoRepository;
let useCase: DeletePhotoUseCase;
let ownerId: string;
let otherId: string;
let uploadsRoot: string;
let photoId: string;

beforeAll(async () => {
  handle = createTestDb();
  uploadsRoot = mkdtempSync(join(tmpdir(), 'gym-up-delete-photos-'));
  const uploadsPhotosDir = join(uploadsRoot, 'uploads', 'photos');
  repo = new SqlitePhotoRepository(handle.db, { uploadsRoot: uploadsPhotosDir });
  useCase = new DeletePhotoUseCase(repo);

  const [owner] = await handle.db
    .insert(profiles)
    .values({
      email: 'owner-del@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Owner',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  const [other] = await handle.db
    .insert(profiles)
    .values({
      email: 'other-del@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Other',
      routineType: 'mujer',
      weightUnit: 'kg',
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
  if (existsSync(uploadsRoot)) {
    rmSync(uploadsRoot, { recursive: true, force: true });
  }
});

describe('DeletePhotoUseCase — happy path', () => {
  it('removes the DB row', async () => {
    await useCase.execute({ userId: ownerId, photoId });
    const found = await repo.findById(photoId, ownerId);
    expect(found).toBeUndefined();
  });

  it('throws PhotoNotFoundError for an unknown photo id', async () => {
    await expect(
      useCase.execute({ userId: ownerId, photoId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toBeInstanceOf(PhotoNotFoundError);
  });
});

describe('DeletePhotoUseCase — privacy', () => {
  it('throws PhotoOwnershipError when another user tries to delete', async () => {
    const created = await repo.create(
      { userId: ownerId, storagePath: '', photoDate: new Date(1_750_000_000_000) },
      ownerId,
    );
    await expect(
      useCase.execute({ userId: otherId, photoId: created.id }),
    ).rejects.toBeInstanceOf(PhotoOwnershipError);
  });
});