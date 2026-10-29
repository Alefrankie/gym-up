// src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository.ts
//
// SQLite-backed implementation of PhotoRepository.
//
// Per ADR-005: photos are private. All write operations and `findById`
// enforce owner-only access via `currentUserId`.
// Per ADR-007 + ADR-012: consumes the Drizzle `db` instance.
// Per ADR-011: `implements`, not `extends`.
//
// Metadata only (ADR-027): this repository stores the row (owner, date, caption and the object key in
// `storagePath`). The bytes live in the object store (`PhotoStorage`: R2 in production), so nothing here
// touches a filesystem and the class runs unchanged inside a Cloudflare Worker.

import { desc, eq } from 'drizzle-orm';
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

function buildStoragePath(userId: string, timestamp: number, extension: string = 'jpg'): string {
  return `photos/${userId}/${timestamp}.${extension}`;
}

export class SqlitePhotoRepository implements PhotoRepository {
  constructor(private readonly db: Db) {}

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
    // Respect a caller-provided storagePath so the file extension matches
    // the uploaded format (jpg/png/webp). When the caller passes an empty
    // string (legacy / tests), fall back to the canonical `{userId}/{ms}.jpg`.
    const storagePath =
      input.storagePath && input.storagePath.length > 0
        ? input.storagePath
        : buildStoragePath(currentUserId, photoDateMs);

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
    // The object itself is removed by the caller through PhotoStorage (RemovePhotoUseCase).
  }
}
