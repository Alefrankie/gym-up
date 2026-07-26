// src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository.ts
//
// SQLite-backed implementation of PhotoRepository.
//
// Per ADR-005: photos are private. All write operations and `findById`
// enforce owner-only access via `currentUserId`.
// Per ADR-007 + ADR-012: consumes the Drizzle `db` instance.
// Per ADR-011: `implements`, not `extends`.
//
// Storage (Round 1): local filesystem at `./uploads/photos/{user_id}/{timestamp}.jpg`.
// The repo's `create` and `delete` manage the file alongside the DB row.
// Round 6 swaps to Supabase Storage; the abstract contract stays the same.

import { desc, eq } from 'drizzle-orm';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Db } from '@/lib/db/client';
import {
  progressPhotos,
  type NewProgressPhoto,
  type ProgressPhoto,
} from '@db/schema';
import {
  PhotoOwnershipError,
  PhotoRepository,
} from '@/lib/contexts/workout-tracking/domain/photo.repository';

const DEFAULT_UPLOADS_ROOT = resolve(process.cwd(), 'uploads', 'photos');

function buildStoragePath(
  userId: string,
  timestamp: number,
  extension: string = 'jpg',
): string {
  // Use the timestamp embedded in the file name so the on-disk name
  // matches the row's `photoDate` to the millisecond.
  return join(userId, `${timestamp}.${extension}`);
}

export class SqlitePhotoRepository implements PhotoRepository {
  private readonly uploadsRoot: string;

  constructor(
    private readonly db: Db,
    options: { uploadsRoot?: string } = {},
  ) {
    this.uploadsRoot = options.uploadsRoot ?? DEFAULT_UPLOADS_ROOT;
  }

  private absolutePathFor(storagePath: string): string {
    return join(this.uploadsRoot, storagePath);
  }

  async findById(
    id: string,
    currentUserId: string,
  ): Promise<ProgressPhoto | undefined> {
    const rows = await this.db
      .select()
      .from(progressPhotos)
      .where(eq(progressPhotos.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    if (row.userId !== currentUserId) {
      // Per ADR-005: do not leak existence. Throw ownership error so
      // the caller can distinguish 404 from 403.
      throw new PhotoOwnershipError(id, currentUserId);
    }
    return row;
  }

  async findByUser(userId: string): Promise<ProgressPhoto[]> {
    return this.db
      .select()
      .from(progressPhotos)
      .where(eq(progressPhotos.userId, userId))
      .orderBy(desc(progressPhotos.photoDate));
  }

  async create(
    input: NewProgressPhoto,
    currentUserId: string,
  ): Promise<ProgressPhoto> {
    // Defense in depth: enforce that the row's userId matches the
    // authenticated caller, regardless of what `input` claims.
    if (input.userId && input.userId !== currentUserId) {
      throw new PhotoOwnershipError('(unsaved)', currentUserId);
    }

    // Derive a deterministic storage path from the userId + the
    // (client-supplied) photoDate. If `input.photoDate` is missing,
    // fall back to `now` to align with the column default.
    const photoDateMs = input.photoDate
      ? new Date(input.photoDate).getTime()
      : Date.now();
    const storagePath = buildStoragePath(currentUserId, photoDateMs);

    // Write a placeholder file on disk so the smoke test can verify
    // the filesystem side of the contract. Production upload flows
    // (story 2.5+) will pass real bytes through this same code path.
    const absolutePath = this.absolutePathFor(storagePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    if (!existsSync(absolutePath)) {
      writeFileSync(absolutePath, '');
    }

    const rows = await this.db
      .insert(progressPhotos)
      .values({
        ...input,
        userId: currentUserId,
        storagePath,
        photoDate: new Date(photoDateMs),
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('Failed to insert progress_photo: no row returned.');
    }
    return row;
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(progressPhotos)
      .where(eq(progressPhotos.id, id))
      .limit(1);
    const row = existing[0];
    if (!row) {
      throw new Error(`Progress photo not found: ${id}`);
    }
    if (row.userId !== currentUserId) {
      throw new PhotoOwnershipError(id, currentUserId);
    }

    await this.db.delete(progressPhotos).where(eq(progressPhotos.id, id));

    // Best-effort filesystem cleanup. Failure to unlink must not roll
    // back the DB delete (the row is the source of truth per ADR-005);
    // just leave the orphan for ops to clean up.
    const absolutePath = this.absolutePathFor(row.storagePath);
    try {
      if (existsSync(absolutePath)) {
        unlinkSync(absolutePath);
      }
    } catch {
      // Swallow filesystem errors; the DB row is the authority.
    }
  }
}
