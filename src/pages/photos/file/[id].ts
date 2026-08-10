// src/pages/photos/file/[id].ts
//
// GET endpoint that streams the bytes of a private photo to the
// authenticated owner. Per ADR-005: NEVER serve a public URL; this
// route verifies session + ownership on every request.
//
// Status codes:
//   - 401  no session / unknown session
//   - 404  photo row does not exist
//   - 403  photo belongs to another user (PhotoOwnershipError)
//   - 200  streams bytes with Content-Type derived from extension

import type { APIRoute } from 'astro';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getSessionIdFromRequest } from '@/lib/auth/cookie-helpers';
import { photoRepository } from '@/lib/contexts/workout-tracking/workout-tracking.composition';
import {
  PhotoOwnershipError,
} from '@/lib/contexts/workout-tracking/domain/photo.repository';
import { uploadsRoot } from '@/lib/contexts/private-photos/private-photos.composition';
import { ContentTypes, type PhotoFormat } from '@/lib/contexts/private-photos/domain/private-photos.types';

function resolveContentType(storagePath: string): string {
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'jpg';
  if (ext === 'png' || ext === 'webp' || ext === 'jpg') {
    return ContentTypes[ext as PhotoFormat];
  }
  return 'application/octet-stream';
}

export const GET: APIRoute = async ({ params, request }) => {
  // 1. Resolve session.
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) {
    return new Response('Unauthorized: no session cookie', { status: 401 });
  }
  const user = await getAuthService().getCurrentUser(sessionId);
  if (!user) {
    return new Response('Unauthorized: invalid session', { status: 401 });
  }

  const id = params.id;
  if (typeof id !== 'string' || id.trim() === '') {
    return new Response('Bad request: missing photo id', { status: 400 });
  }

  // 2. Resolve the row with owner check.
  let photo;
  try {
    photo = await photoRepository.findById(id, user.id);
  } catch (err) {
    if (err instanceof PhotoOwnershipError) {
      return new Response('Forbidden: photo belongs to another user', { status: 403 });
    }
    throw err;
  }
  if (!photo) {
    return new Response('Not found: photo does not exist', { status: 404 });
  }

  // 3. Stream the file.
  const absolutePath = join(uploadsRoot, photo.storagePath);
  if (!existsSync(absolutePath)) {
    return new Response('Not found: file is missing on disk', { status: 404 });
  }
  const bytes = readFileSync(absolutePath);

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': resolveContentType(photo.storagePath),
      'Cache-Control': 'private, max-age=60',
    },
  });
};