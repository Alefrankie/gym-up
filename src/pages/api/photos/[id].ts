// src/pages/api/photos/[id].ts
//
// DELETE endpoint that removes a photo (DB row + file on disk).
// Owner-only — PhotoOwnershipError maps to 403.
//
// Status codes:
//   - 401  no session / unknown session
//   - 400  missing photo id
//   - 404  photo row does not exist (PhotoNotFoundError)
//   - 403  photo belongs to another user (PhotoOwnershipError)
//   - 303  redirect to /photos on success

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getSessionIdFromRequest } from '@/lib/auth/cookie-helpers';
import {
  deletePhotoUseCase,
} from '@/lib/contexts/private-photos/private-photos.composition';
import {
  PhotoOwnershipError,
} from '@/lib/contexts/workout-tracking/domain/photo.repository';
import { PhotoNotFoundError } from '@/lib/contexts/private-photos/application/delete-photo.use-case';

export const DELETE: APIRoute = async ({ params, request, redirect }) => {
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

  // 2. Run the use case.
  try {
    await deletePhotoUseCase.execute({ userId: user.id, photoId: id });
  } catch (err) {
    if (err instanceof PhotoNotFoundError) {
      return new Response('Not found: photo does not exist', { status: 404 });
    }
    if (err instanceof PhotoOwnershipError) {
      return new Response('Forbidden: photo belongs to another user', { status: 403 });
    }
    throw err;
  }

  return redirect('/photos', 303);
};