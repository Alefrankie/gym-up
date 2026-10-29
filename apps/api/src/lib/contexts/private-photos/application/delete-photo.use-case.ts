// src/lib/contexts/private-photos/application/delete-photo.use-case.ts
//
// Use case: delete a photo (DB row + file on disk) owned by the current
// user. Cross-user attempts throw `PhotoOwnershipError` (already defined
// in the workout-tracking domain) and are mapped to HTTP 403 at the
// endpoint.

import type { PhotoRepository } from '@/lib/contexts/workout-tracking/domain/photo.repository';

export class PhotoNotFoundError extends Error {
  constructor(public readonly photoId: string) {
    super(`Photo not found: ${photoId}`);
    this.name = 'PhotoNotFoundError';
  }
}

export interface DeletePhotoInput {
  userId: string;
  photoId: string;
}

export class DeletePhotoUseCase {
  constructor(private readonly photoRepository: PhotoRepository) {}

  async execute(input: DeletePhotoInput): Promise<void> {
    // `findById` returns `undefined` when the row does not exist and
    // throws `PhotoOwnershipError` when it belongs to another user —
    // the ownership check is enforced at the SQL layer, so the use
    // case only needs to discriminate "not found" vs "found".
    const photo = await this.photoRepository.findById(input.photoId, input.userId);
    if (!photo) {
      throw new PhotoNotFoundError(input.photoId);
    }
    await this.photoRepository.delete(input.photoId, input.userId);
  }
}