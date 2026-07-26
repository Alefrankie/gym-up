// src/lib/contexts/workout-tracking/domain/photo.repository.ts
//
// Abstract contract for progress photo metadata persistence.
//
// Per ADR-005: photos are private. `findById` and `delete` take a
// `currentUserId` and throw if the row belongs to a different user
// (owner-only). `findByUser(userId)` returns only that user's photos.
// Per ADR-007 + ADR-011: concrete classes `implements` this.

import type { ProgressPhoto, NewProgressPhoto } from '@db/schema';

export class PhotoOwnershipError extends Error {
  constructor(
    public readonly photoId: string,
    public readonly currentUserId: string,
  ) {
    super(`Photo ${photoId} does not belong to user ${currentUserId}`);
    this.name = 'PhotoOwnershipError';
  }
}

export abstract class PhotoRepository {
  /**
   * Look up a photo by id. Owner-only — throws `PhotoOwnershipError`
   * if the photo belongs to a different user.
   */
  abstract findById(
    id: string,
    currentUserId: string,
  ): Promise<ProgressPhoto | undefined>;

  /**
   * List all photos for a user, newest first. Read-self (no auth check
   * needed; caller is asking on behalf of `userId`).
   */
  abstract findByUser(userId: string): Promise<ProgressPhoto[]>;

  /**
   * Create a photo row. `currentUserId` is the owner; the row's userId
   * is set from this value (defense in depth — never trust input).
   * Throws if `input.userId` disagrees with `currentUserId`.
   */
  abstract create(
    input: NewProgressPhoto,
    currentUserId: string,
  ): Promise<ProgressPhoto>;

  /**
   * Delete a photo (and its file on disk in the SQLite impl). Owner-only.
   * Throws `PhotoOwnershipError` on cross-user attempts.
   */
  abstract delete(id: string, currentUserId: string): Promise<void>;
}
