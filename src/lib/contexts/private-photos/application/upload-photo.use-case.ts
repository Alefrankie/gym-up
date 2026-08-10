// src/lib/contexts/private-photos/application/upload-photo.use-case.ts
//
// Use case: upload a photo owned by the current user.
//
// Pipeline:
//   1. Validate (size ≤ 5MB, format ∈ {jpg, png, webp}, caption ≤ 200 chars).
//   2. Derive storagePath from (userId, photoDate) — same shape the
//      `SqlitePhotoRepository` uses, so a future `LocalPhotoStorageAdapter`
//      split only needs to swap the filesystem write.
//   3. Write the real bytes to disk FIRST. The repo's `create()` skips
//      writing a placeholder file when the path already exists, so the
//      pre-write avoids the placeholder dance.
//   4. Call `repo.create({userId, storagePath, photoDate, caption}, userId)`
//      — the repo enforces ownership at the SQL layer (defense in depth).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ProgressPhoto } from '@db/schema';
import type { PhotoRepository } from '@/lib/contexts/workout-tracking/domain/photo.repository';
import { PhotoRules, type PhotoFormat } from '../domain/private-photos.types';

const SUPPORTED_FORMATS: ReadonlySet<PhotoFormat> = new Set(['jpg', 'png', 'webp']);

export class PhotoSizeExceededError extends Error {
  constructor(public readonly actualBytes: number) {
    super(
      `Photo exceeds ${PhotoRules.MaxSizeBytes} bytes (got ${actualBytes}).`,
    );
    this.name = 'PhotoSizeExceededError';
  }
}

export class UnsupportedPhotoFormatError extends Error {
  constructor(public readonly format: string) {
    super(`Unsupported photo format: ${format}. Allowed: jpg, png, webp.`);
    this.name = 'UnsupportedPhotoFormatError';
  }
}

export class CaptionTooLongError extends Error {
  constructor(public readonly actualLength: number) {
    super(
      `Caption exceeds ${PhotoRules.MaxCaptionLength} characters (got ${actualLength}).`,
    );
    this.name = 'CaptionTooLongError';
  }
}

export class EmptyPhotoBytesError extends Error {
  constructor() {
    super('Photo bytes are empty.');
    this.name = 'EmptyPhotoBytesError';
  }
}

export interface UploadPhotoInput {
  userId: string;
  bytes: Uint8Array;
  format: PhotoFormat;
  caption?: string | null;
  photoDate?: Date;
}

export interface UploadPhotoResult {
  photo: ProgressPhoto;
  absolutePath: string;
  bytesWritten: number;
}

export interface UploadPhotoOptions {
  uploadsRoot: string;
}

export class UploadPhotoUseCase {
  constructor(
    private readonly photoRepository: PhotoRepository,
    private readonly options: UploadPhotoOptions,
  ) {}

  async execute(input: UploadPhotoInput): Promise<UploadPhotoResult> {
    this.validate(input);

    const photoDate = input.photoDate ?? new Date();
    const photoDateMs = photoDate.getTime();
    const storagePath = buildStoragePath(input.userId, photoDateMs, input.format);
    const absolutePath = join(this.options.uploadsRoot, storagePath);

    // Write real bytes first. The repo's `create()` will skip its
    // placeholder write because the file now exists.
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, input.bytes);

    const photo = await this.photoRepository.create(
      {
        userId: input.userId,
        storagePath,
        photoDate,
        caption: input.caption ?? null,
      },
      input.userId,
    );

    return {
      photo,
      absolutePath,
      bytesWritten: input.bytes.length,
    };
  }

  private validate(input: UploadPhotoInput): void {
    if (input.bytes.length === 0) {
      throw new EmptyPhotoBytesError();
    }
    if (input.bytes.length > PhotoRules.MaxSizeBytes) {
      throw new PhotoSizeExceededError(input.bytes.length);
    }
    if (!SUPPORTED_FORMATS.has(input.format)) {
      throw new UnsupportedPhotoFormatError(input.format);
    }
    if (input.caption && input.caption.length > PhotoRules.MaxCaptionLength) {
      throw new CaptionTooLongError(input.caption.length);
    }
  }
}

/** Mirrors `SqlitePhotoRepository.buildStoragePath` shape — `{userId}/{ms}.{ext}`. */
function buildStoragePath(
  userId: string,
  photoDateMs: number,
  format: PhotoFormat,
): string {
  return join(userId, `${photoDateMs}.${format}`);
}