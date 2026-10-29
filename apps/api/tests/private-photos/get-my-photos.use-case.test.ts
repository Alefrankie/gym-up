// tests/private-photos/get-my-photos.use-case.test.ts
//
// AC-4.2-03 — gallery loads only the owner's photos. Each entry must
// expose an authenticated URL (`/photos/file/{id}`), never a public
// filesystem path or a signed-URL fragment.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GetMyPhotosUseCase,
} from '@/lib/contexts/private-photos/application/get-my-photos.use-case';
import { SqlitePhotoRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import { profiles } from '@db/schema';

let handle: TestDbHandle;
let repo: SqlitePhotoRepository;
let useCase: GetMyPhotosUseCase;
let ownerId: string;
let otherId: string;
let uploadsRoot: string;

beforeAll(async () => {
  handle = createTestDb();
  uploadsRoot = mkdtempSync(join(tmpdir(), 'gym-up-get-photos-'));
  const uploadsPhotosDir = join(uploadsRoot, 'uploads', 'photos');
  repo = new SqlitePhotoRepository(handle.db, { uploadsRoot: uploadsPhotosDir });
  useCase = new GetMyPhotosUseCase(repo);

  const [owner] = await handle.db
    .insert(profiles)
    .values({
      email: 'owner-getphotos@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Owner',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  const [other] = await handle.db
    .insert(profiles)
    .values({
      email: 'other-getphotos@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Other',
      routineType: 'mujer',
      weightUnit: 'kg',
    })
    .returning();
  ownerId = owner.id;
  otherId = other.id;
});

afterAll(() => {
  handle.close();
  if (existsSync(uploadsRoot)) {
    rmSync(uploadsRoot, { recursive: true, force: true });
  }
});

describe('GetMyPhotosUseCase — happy path', () => {
  it('returns an empty array when the owner has no photos', async () => {
    const result = await useCase.execute({ userId: ownerId });
    expect(result).toEqual([]);
  });

  it('returns the owner photos sorted by date descending', async () => {
    // Insert two photos for owner and one for other user.
    await repo.create(
      { userId: ownerId, storagePath: '', photoDate: new Date(1_700_000_000_000) },
      ownerId,
    );
    await repo.create(
      { userId: ownerId, storagePath: '', photoDate: new Date(1_800_000_000_000) },
      ownerId,
    );
    await repo.create(
      { userId: otherId, storagePath: '', photoDate: new Date(1_700_000_000_000) },
      otherId,
    );

    const result = await useCase.execute({ userId: ownerId });
    expect(result).toHaveLength(2);
    // Newest first: photoDate 1_800_000_000_000 must come first.
    expect(new Date(result[0]!.date).getTime()).toBeGreaterThan(
      new Date(result[1]!.date).getTime(),
    );
  });

  it('emits an authenticated URL (`/photos/file/{id}`) per photo', async () => {
    // Use a fresh user so we get a single deterministic photo.
    const [solo] = await handle.db
      .insert(profiles)
      .values({
        email: 'solo-getphotos@example.com',
        passwordHash: 'hashed_password',
        displayName: 'Solo',
        routineType: 'hombre',
        weightUnit: 'kg',
      })
      .returning();
    const created = await repo.create(
      { userId: solo.id, storagePath: '', photoDate: new Date(1_900_000_000_000) },
      solo.id,
    );
    const result = await useCase.execute({ userId: solo.id });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(created.id);
    expect(result[0]!.url).toBe(`/photos/file/${created.id}`);
    // Must NOT leak the filesystem path.
    expect(result[0]!.url).not.toMatch(/uploads/);
    expect(result[0]!.url).not.toMatch(/\.jpg$/);
  });

  it('returns null caption when the user did not set one', async () => {
    const [nocap] = await handle.db
      .insert(profiles)
      .values({
        email: 'nocap-getphotos@example.com',
        passwordHash: 'hashed_password',
        displayName: 'NoCap',
        routineType: 'hombre',
        weightUnit: 'kg',
      })
      .returning();
    await repo.create(
      { userId: nocap.id, storagePath: '', photoDate: new Date(2_000_000_000_000) },
      nocap.id,
    );
    const result = await useCase.execute({ userId: nocap.id });
    expect(result[0]!.caption).toBeNull();
  });
});

describe('GetMyPhotosUseCase — privacy', () => {
  it('NEVER returns another user\'s photos', async () => {
    // Two users each with their own photo.
    const [a] = await handle.db
      .insert(profiles)
      .values({
        email: 'a-priv@example.com',
        passwordHash: 'hashed_password',
        displayName: 'A',
        routineType: 'hombre',
        weightUnit: 'kg',
      })
      .returning();
    const [b] = await handle.db
      .insert(profiles)
      .values({
        email: 'b-priv@example.com',
        passwordHash: 'hashed_password',
        displayName: 'B',
        routineType: 'mujer',
        weightUnit: 'kg',
      })
      .returning();
    await repo.create(
      { userId: a.id, storagePath: '', photoDate: new Date(1_700_000_000_000) },
      a.id,
    );
    await repo.create(
      { userId: b.id, storagePath: '', photoDate: new Date(1_700_000_000_000) },
      b.id,
    );

    const aResult = await useCase.execute({ userId: a.id });
    const bResult = await useCase.execute({ userId: b.id });
    expect(aResult.every((p) => p.url.includes(`/photos/file/`))).toBe(true);
    expect(bResult.every((p) => p.url.includes(`/photos/file/`))).toBe(true);
    // Each user sees exactly one photo, and it's their own.
    expect(aResult).toHaveLength(1);
    expect(bResult).toHaveLength(1);
  });
});