// tests/private-photos/upload-photo.use-case.test.ts
//
// AC-4.2-01 — upload with size + format + caption validation.
// Verifies the use case:
//   1. Rejects files > 5MB
//   2. Rejects unsupported formats
//   3. Rejects captions longer than 200 chars
//   4. Writes bytes to disk at {uploadsRoot}/{userId}/{timestamp}.{ext}
//   5. Persists a progress_photos row with the matching storagePath

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  UploadPhotoUseCase,
  PhotoSizeExceededError,
  UnsupportedPhotoFormatError,
  CaptionTooLongError,
} from '@/lib/contexts/private-photos/application/upload-photo.use-case';
import { SqlitePhotoRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import { profiles } from '@db/schema';

let handle: TestDbHandle;
let repo: SqlitePhotoRepository;
let useCase: UploadPhotoUseCase;
let userId: string;
let uploadsRoot: string;

beforeAll(async () => {
  handle = createTestDb();
  uploadsRoot = mkdtempSync(join(tmpdir(), 'gym-up-upload-photos-'));
  const uploadsPhotosDir = join(uploadsRoot, 'uploads', 'photos');
  repo = new SqlitePhotoRepository(handle.db, { uploadsRoot: uploadsPhotosDir });
  useCase = new UploadPhotoUseCase(repo, { uploadsRoot: uploadsPhotosDir });

  const [u] = await handle.db
    .insert(profiles)
    .values({
      email: 'upload-up@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Uploader',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = u.id;
});

afterAll(() => {
  handle.close();
  if (existsSync(uploadsRoot)) {
    rmSync(uploadsRoot, { recursive: true, force: true });
  }
});

beforeEach(() => {
  // Each test gets a clean uploads dir to keep assertions simple.
});

function fakeBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) arr[i] = i % 256;
  return arr;
}

describe('UploadPhotoUseCase — validation', () => {
  it('rejects files larger than 5MB', async () => {
    const big = fakeBytes(5 * 1024 * 1024 + 1);
    await expect(
      useCase.execute({
        userId,
        bytes: big,
        format: 'jpg',
      }),
    ).rejects.toBeInstanceOf(PhotoSizeExceededError);
  });

  it('accepts files exactly at 5MB', async () => {
    const exact = fakeBytes(5 * 1024 * 1024);
    const result = await useCase.execute({
      userId,
      bytes: exact,
      format: 'jpg',
    });
    expect(result.bytesWritten).toBe(5 * 1024 * 1024);
  });

  it('rejects unsupported formats', async () => {
    await expect(
      useCase.execute({
        userId,
        bytes: fakeBytes(100),
        // @ts-expect-error — testing runtime guard
        format: 'gif',
      }),
    ).rejects.toBeInstanceOf(UnsupportedPhotoFormatError);
  });

  it('rejects captions longer than 200 chars', async () => {
    await expect(
      useCase.execute({
        userId,
        bytes: fakeBytes(100),
        format: 'jpg',
        caption: 'x'.repeat(201),
      }),
    ).rejects.toBeInstanceOf(CaptionTooLongError);
  });

  it('rejects empty bytes', async () => {
    await expect(
      useCase.execute({
        userId,
        bytes: new Uint8Array(0),
        format: 'jpg',
      }),
    ).rejects.toThrow();
  });
});

describe('UploadPhotoUseCase — happy path', () => {
  it('writes bytes to disk at {uploadsRoot}/{userId}/{timestamp}.{ext}', async () => {
    const bytes = fakeBytes(2048);
    const result = await useCase.execute({
      userId,
      bytes,
      format: 'jpg',
      photoDate: new Date(1_700_000_000_000),
    });
    expect(existsSync(result.absolutePath)).toBe(true);
    expect(readFileSync(result.absolutePath).equals(Buffer.from(bytes))).toBe(true);
  });

  it('persists a progress_photos row pointing at the file', async () => {
    const bytes = fakeBytes(1024);
    const result = await useCase.execute({
      userId,
      bytes,
      format: 'png',
      caption: 'leg day',
      photoDate: new Date(1_750_000_000_000),
    });
    expect(result.photo.userId).toBe(userId);
    expect(result.photo.caption).toBe('leg day');
    expect(result.photo.storagePath).toMatch(/\.png$/);
  });
});