// src/pages/nutrition/photo/[id].ts
//
// GET endpoint that streams the bytes of a private nutrition photo to
// the authenticated owner. Per ADR-005: NEVER serve a public URL;
// this route verifies session + ownership on every request.
//
// Status codes:
//   401  no session / unknown session
//   404  entry does not exist
//   403  entry belongs to another user (NutritionEntryOwnershipError)
//   200  streams bytes with Content-Type derived from extension

import type { APIRoute } from 'astro';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getSessionIdFromRequest } from '@/lib/auth/cookie-helpers';
import {
  getNutritionEntryRepository,
  uploadsRoot,
} from '@/lib/contexts/nutrition/nutrition.composition';
import { NutritionEntryOwnershipError } from '@/lib/contexts/nutrition/domain/nutrition-entry-repository';
import {
  ContentTypes,
  type PhotoFormat,
} from '@/lib/contexts/nutrition/domain/nutrition.types';

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
    return new Response('Bad request: missing entry id', { status: 400 });
  }

  // 2. Resolve the row with owner check.
  const repo = getNutritionEntryRepository();
  let entry;
  try {
    entry = await repo.findById(id, user.id);
  } catch (err) {
    if (err instanceof NutritionEntryOwnershipError) {
      return new Response('Forbidden: entry belongs to another user', {
        status: 403,
      });
    }
    throw err;
  }
  if (!entry) {
    return new Response('Not found: entry does not exist', { status: 404 });
  }

  // 3. Stream the file.
  const absolutePath = join(uploadsRoot, entry.storagePath);
  if (!existsSync(absolutePath)) {
    return new Response('Not found: file is missing on disk', { status: 404 });
  }
  const bytes = readFileSync(absolutePath);

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': resolveContentType(entry.storagePath),
      'Cache-Control': 'private, max-age=60',
    },
  });
};
