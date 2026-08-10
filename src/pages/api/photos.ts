// src/pages/api/photos.ts
//
// POST endpoint that accepts a multipart upload for a private photo.
// Validates size + format + caption length, hands the bytes to
// `UploadPhotoUseCase`, and redirects to /photos on success (PRG).
//
// Status codes:
//   - 401  no session / unknown session
//   - 400  missing/invalid file, format rejected, size > 5MB, caption > 200
//   - 303  redirect to /photos on success

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getSessionIdFromRequest } from '@/lib/auth/cookie-helpers';
import {
  uploadPhotoUseCase,
} from '@/lib/contexts/private-photos/private-photos.composition';
import {
  PhotoSizeExceededError,
  UnsupportedPhotoFormatError,
  CaptionTooLongError,
  EmptyPhotoBytesError,
} from '@/lib/contexts/private-photos/application/upload-photo.use-case';
import type { PhotoFormat } from '@/lib/contexts/private-photos/domain/private-photos.types';

const ALLOWED_FORMATS: ReadonlySet<PhotoFormat> = new Set(['jpg', 'png', 'webp']);

function formatFromMime(mime: string): PhotoFormat | null {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

function extensionFromFilename(filename: string): PhotoFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.webp')) return 'webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
  return null;
}

export const POST: APIRoute = async ({ request, redirect }) => {
  // 1. Resolve session.
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) {
    return new Response('Unauthorized: no session cookie', { status: 401 });
  }
  const user = await getAuthService().getCurrentUser(sessionId);
  if (!user) {
    return new Response('Unauthorized: invalid session', { status: 401 });
  }

  // 2. Parse multipart form.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response('Bad request: malformed multipart body', { status: 400 });
  }
  const file = formData.get('file');
  const captionRaw = formData.get('caption');
  const caption = typeof captionRaw === 'string' && captionRaw.trim() !== ''
    ? captionRaw.trim()
    : null;

  if (!(file instanceof File)) {
    return new Response('Bad request: missing file', { status: 400 });
  }

  // 3. Resolve format from MIME type or filename extension.
  const format = formatFromMime(file.type) ?? extensionFromFilename(file.name);
  if (!format || !ALLOWED_FORMATS.has(format)) {
    return new Response('Bad request: unsupported file format', { status: 400 });
  }

  // 4. Run the use case (validates size, format, caption internally).
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadPhotoUseCase.execute({
      userId: user.id,
      bytes,
      format,
      caption,
    });
  } catch (err) {
    if (
      err instanceof PhotoSizeExceededError ||
      err instanceof UnsupportedPhotoFormatError ||
      err instanceof CaptionTooLongError ||
      err instanceof EmptyPhotoBytesError
    ) {
      return new Response(`Bad request: ${err.message}`, { status: 400 });
    }
    throw err;
  }

  return redirect('/photos', 303);
};