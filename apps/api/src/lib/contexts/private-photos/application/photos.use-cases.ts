// src/lib/contexts/private-photos/application/photos.use-cases.ts
//
// Private progress photos (ADR-005): owner-only, never part of the family view. The bytes live in the object
// store (R2 in production); the database row holds the object key, the date and the caption. Uploads are
// idempotent by client-generated id (ADR-025), so a retry after a dropped connection never stores a second copy.

import type { ProgressPhoto } from '@db/schema';
import type { PhotoRepository } from '@/lib/contexts/workout-tracking/domain/photo.repository';
import { PhotoStorage } from '../domain/photo-storage';
import { ContentTypes, PhotoRules, type PhotoFormat } from '../domain/private-photos.types';

export class PhotoSizeExceededError extends Error {
  constructor(public readonly actualBytes: number) {
    super(`Photo exceeds ${PhotoRules.MaxSizeBytes} bytes (got ${actualBytes}).`);
    this.name = 'PhotoSizeExceededError';
  }
}

export class UnsupportedPhotoFormatError extends Error {
  constructor(public readonly contentType: string) {
    super(`Unsupported photo type: ${contentType}. Allowed: image/jpeg, image/png, image/webp.`);
    this.name = 'UnsupportedPhotoFormatError';
  }
}

export class CaptionTooLongError extends Error {
  constructor(public readonly actualLength: number) {
    super(`Caption exceeds ${PhotoRules.MaxCaptionLength} characters (got ${actualLength}).`);
    this.name = 'CaptionTooLongError';
  }
}

export class EmptyPhotoBytesError extends Error {
  constructor() {
    super('Photo bytes are empty.');
    this.name = 'EmptyPhotoBytesError';
  }
}

export class PhotoNotFoundError extends Error {
  constructor(public readonly photoId: string) {
    super(`Photo not found: ${photoId}`);
    this.name = 'PhotoNotFoundError';
  }
}

const FORMAT_BY_CONTENT_TYPE: Readonly<Record<string, PhotoFormat>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const photoKey = (userId: string, photoId: string, format: PhotoFormat) => `photos/${userId}/${photoId}.${format}`;

export function formatOfKey(storagePath: string): PhotoFormat {
  const ext = storagePath.split('.').pop() as PhotoFormat;
  return ext in ContentTypes ? ext : 'jpg';
}

export interface StorePhotoInput {
  userId: string;
  /** Client-generated id. */
  id: string;
  bytes: Uint8Array;
  contentType: string;
  caption?: string | null;
  photoDate?: Date;
}

export class StorePhotoUseCase {
  constructor(
    private readonly photos: PhotoRepository,
    private readonly storage: PhotoStorage,
  ) {}

  async execute(input: StorePhotoInput): Promise<{ photo: ProgressPhoto; created: boolean }> {
    const format = FORMAT_BY_CONTENT_TYPE[input.contentType];
    if (!format) throw new UnsupportedPhotoFormatError(input.contentType);
    if (input.bytes.byteLength === 0) throw new EmptyPhotoBytesError();
    if (input.bytes.byteLength > PhotoRules.MaxSizeBytes) throw new PhotoSizeExceededError(input.bytes.byteLength);
    const caption = input.caption?.trim() || null;
    if (caption && caption.length > PhotoRules.MaxCaptionLength) throw new CaptionTooLongError(caption.length);

    // Replay of the same client id: the photo is already stored.
    const existing = await this.photos.findById(input.id, input.userId).catch(() => undefined);
    if (existing) return { photo: existing, created: false };

    const key = photoKey(input.userId, input.id, format);
    await this.storage.put(key, input.bytes, input.contentType);
    try {
      const photo = await this.photos.create(
        { id: input.id, userId: input.userId, storagePath: key, caption, photoDate: input.photoDate ?? new Date() },
        input.userId,
      );
      return { photo, created: true };
    } catch (err) {
      await this.storage.delete(key); // never leave an orphan object behind
      throw err;
    }
  }
}

export class ListMyPhotosUseCase {
  constructor(private readonly photos: PhotoRepository) {}

  /** Newest first. */
  async execute(userId: string): Promise<ProgressPhoto[]> {
    const all = await this.photos.findByUser(userId);
    return [...all].sort((a, b) => b.photoDate.getTime() - a.photoDate.getTime());
  }
}

export class GetPhotoFileUseCase {
  constructor(
    private readonly photos: PhotoRepository,
    private readonly storage: PhotoStorage,
  ) {}

  /** Owner only: another user's id is reported as "not found" so photo ids cannot be probed. */
  async execute(userId: string, photoId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const photo = await this.photos.findById(photoId, userId).catch(() => undefined);
    if (!photo || photo.userId !== userId) throw new PhotoNotFoundError(photoId);
    const object = await this.storage.get(photo.storagePath);
    if (!object) throw new PhotoNotFoundError(photoId);
    return { bytes: object.bytes, contentType: ContentTypes[formatOfKey(photo.storagePath)] };
  }
}

export class RemovePhotoUseCase {
  constructor(
    private readonly photos: PhotoRepository,
    private readonly storage: PhotoStorage,
  ) {}

  async execute(userId: string, photoId: string): Promise<void> {
    const photo = await this.photos.findById(photoId, userId).catch(() => undefined);
    if (!photo || photo.userId !== userId) throw new PhotoNotFoundError(photoId);
    await this.photos.delete(photoId, userId);
    await this.storage.delete(photo.storagePath);
  }
}
