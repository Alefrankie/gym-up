import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';

export const photoContentTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);
export type PhotoContentType = z.infer<typeof photoContentTypeSchema>;

/** Largest accepted upload. The app compresses photos on the device first, so real uploads are far smaller. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_CAPTION_LENGTH = 200;

/** Metadata of a private progress photo (ADR-005). The bytes come from `GET /photos/:id/file`, owner only. */
export const photoSchema = z.object({
  id: idSchema,
  photoDate: isoDateSchema,
  caption: z.string().nullable(),
  contentType: photoContentTypeSchema,
});
export type PhotoDto = z.infer<typeof photoSchema>;

export const photoListResponseSchema = z.array(photoSchema);
