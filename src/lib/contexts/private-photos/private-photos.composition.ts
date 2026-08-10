// src/lib/contexts/private-photos/private-photos.composition.ts
//
// Per-context composition root (ADR-010) for private photos.
//
// Re-exports `photoRepository` from the workout-tracking composition
// (story 4.2 decision: keep the repo co-located with the storage layer
// for now; a future context split is documented as a known gap).
// Defines `uploadsRoot` once and wires the three use cases.
//
// The endpoint handlers (`/api/photos`, `/photos/file/[id]`) import from
// here — never from `workout-tracking.composition` directly.

import { resolve } from 'node:path';
import { photoRepository } from '@/lib/contexts/workout-tracking/workout-tracking.composition';
import { GetMyPhotosUseCase } from './application/get-my-photos.use-case';
import { UploadPhotoUseCase } from './application/upload-photo.use-case';
import { DeletePhotoUseCase } from './application/delete-photo.use-case';

/**
 * Filesystem root for stored photos. Each user's folder lives at
 * `${uploadsRoot}/{user_id}/{timestamp}.{ext}` — the same shape the
 * `SqlitePhotoRepository` derives on disk. Endpoints read this to
 * resolve a `storage_path` back to absolute bytes.
 */
export const uploadsRoot = resolve(process.cwd(), 'uploads', 'photos');

export const getMyPhotosUseCase = new GetMyPhotosUseCase(photoRepository);
export const uploadPhotoUseCase = new UploadPhotoUseCase(photoRepository, {
  uploadsRoot,
});
export const deletePhotoUseCase = new DeletePhotoUseCase(photoRepository);