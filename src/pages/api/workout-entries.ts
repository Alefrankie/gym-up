// src/pages/api/workout-entries.ts
//
// POST endpoint for logging a set (auto-save). Hired by the workout page's
// auto-save module (story 2.4). Implementation: story 2.4.
//
// Request contract (JSON, AC-2.4-07):
//   Content-Type: application/json
//   {
//     "workoutId":   "uuid",
//     "exerciseId":  "uuid",
//     "setNumber":   1,
//     "reps":        10,
//     "weight":      60,           // in user's unit (kg or lbs)
//     "weightUnit":  "kg" | "lbs",
//     "completed":   false,
//     "notes":       null | "string"
//   }
//
// Response:
//   201 Created (new entry) or 200 OK (updated entry) with
//   { "kind": "created" | "updated", "entry": { ...WorkoutEntry } }
//   400 Bad request: invalid JSON or validation error
//   401 Unauthorized: no session
//   403 Forbidden: cross-user workout
//   404 Not found: workout does not exist

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getSessionIdFromRequest } from '@/lib/auth/cookie-helpers';
import { logSetUseCase } from '@/lib/contexts/workout-tracking/workout-tracking.composition';
import {
  LogSetValidationError,
  WorkoutNotFoundError,
} from '@/lib/contexts/workout-tracking/application/log-set.use-case';
import { WorkoutOwnershipError } from '@/lib/contexts/workout-tracking/domain/workout.repository';

interface LogSetPayload {
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
  weightUnit: 'kg' | 'lbs';
  completed: boolean;
  notes: string | null;
}

function isLogSetPayload(value: unknown): value is LogSetPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.workoutId === 'string' &&
    typeof v.exerciseId === 'string' &&
    typeof v.setNumber === 'number' &&
    typeof v.reps === 'number' &&
    typeof v.weight === 'number' &&
    (v.weightUnit === 'kg' || v.weightUnit === 'lbs') &&
    typeof v.completed === 'boolean' &&
    (v.notes === null || typeof v.notes === 'string')
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  // 1. Resolve session.
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) {
    return jsonResponse(401, { error: 'Unauthorized: no session' });
  }
  const user = await getAuthService().getCurrentUser(sessionId);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized: invalid session' });
  }

  // 2. Parse JSON body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Bad request: invalid JSON' });
  }
  if (!isLogSetPayload(body)) {
    return jsonResponse(400, { error: 'Bad request: missing or invalid fields' });
  }

  // 3. Call use case.
  try {
    const result = await logSetUseCase.execute({ ...body, userId: user.id });
    return jsonResponse(result.kind === 'created' ? 201 : 200, result);
  } catch (err) {
    if (err instanceof LogSetValidationError) {
      return jsonResponse(400, { error: err.message });
    }
    if (err instanceof WorkoutNotFoundError) {
      return jsonResponse(404, { error: 'Workout not found' });
    }
    if (err instanceof WorkoutOwnershipError) {
      return jsonResponse(403, { error: 'Forbidden' });
    }
    // Unknown error — let Astro handle as 500.
    throw err;
  }
};
