import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';

export const photoSchema = z.object({
  id: idSchema,
  workoutId: idSchema.nullable(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  createdAt: isoDateSchema,
});
export type PhotoDto = z.infer<typeof photoSchema>;

/** Step 1 of an upload: ask for a presigned R2 URL (owner-only, ADR-005). */
export const createPhotoUploadRequestSchema = z.object({
  id: idSchema,
  workoutId: idSchema.nullable().default(null),
  contentType: photoSchema.shape.contentType,
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});
export type CreatePhotoUploadRequest = z.infer<typeof createPhotoUploadRequestSchema>;

export const createPhotoUploadResponseSchema = z.object({
  photo: photoSchema,
  uploadUrl: z.string().url(),
  expiresAt: isoDateSchema,
});
export type CreatePhotoUploadResponse = z.infer<typeof createPhotoUploadResponseSchema>;

export const photoUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: isoDateSchema,
});
export type PhotoUrlResponse = z.infer<typeof photoUrlResponseSchema>;
