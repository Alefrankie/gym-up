// src/lib/contexts/private-photos/application/get-my-photos.use-case.ts
//
// Use case: list the authenticated user's photos for the gallery.
// Reads from `PhotoRepository.findByUser(userId)` and maps each row
// to a `PhotoViewDTO` (id + authenticated URL + ISO date + caption).
//
// Per ADR-005: never expose a public URL or filesystem path. The DTO
// carries only the photo id; the gallery builds `/photos/file/{id}`
// which is served by an endpoint that re-checks ownership per request.

import type { ProgressPhoto } from '@db/schema';
import type { PhotoRepository } from '@/lib/contexts/workout-tracking/domain/photo.repository';
import { buildPhotoUrl, type PhotoViewDTO } from '../domain/private-photos.types';

export interface GetMyPhotosInput {
  /** Owner (== current session user). The repo filters by this. */
  userId: string;
}

export class GetMyPhotosUseCase {
  constructor(private readonly photoRepository: PhotoRepository) {}

  async execute(input: GetMyPhotosInput): Promise<PhotoViewDTO[]> {
    const rows = await this.photoRepository.findByUser(input.userId);
    return rows.map(toPhotoView);
  }
}

function toPhotoView(row: ProgressPhoto): PhotoViewDTO {
  return {
    id: row.id,
    url: buildPhotoUrl(row.id),
    date: new Date(row.photoDate).toISOString(),
    caption: row.caption,
  };
}