// src/pages/api/workouts.ts
//
// POST endpoint for starting or resuming a workout. Hired by the
// dashboard's "Empezar entrenamiento" / "Continuar entrenamiento"
// forms (story 2.1). Implementation: story 2.2.
//
// Form contract (from dashboard.astro):
//   - routine_day_id (required) — UUID of the routine_day
//   - workout_id (optional) — UUID of an existing workout, for the
//     Continue path. If provided, the endpoint verifies ownership and
//     redirects to it without inserting.
//
// Responses:
//   - 303 redirect to /workout/[id] on success
//   - 400 on missing or invalid form data / unknown routine_day
//   - 401 on missing or invalid session
//   - 403 on cross-user workout_id (Continue path)

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getSessionIdFromRequest } from '@/lib/auth/cookie-helpers';
import { startWorkoutUseCase } from '@/lib/contexts/workout-tracking/workout-tracking.composition';
import {
  WorkoutNotFoundError,
  InvalidRoutineDayError,
} from '@/lib/contexts/workout-tracking/application/start-workout.use-case';
import { WorkoutOwnershipError } from '@/lib/contexts/workout-tracking/domain/workout.repository';

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

  // 2. Parse form data.
  const formData = await request.formData();
  const routineDayId = formData.get('routine_day_id');
  const existingWorkoutId = formData.get('workout_id');

  if (typeof routineDayId !== 'string' || routineDayId.trim() === '') {
    return new Response('Bad request: missing or invalid routine_day_id', {
      status: 400,
    });
  }

  const trimmedExistingId =
    typeof existingWorkoutId === 'string' && existingWorkoutId.trim() !== ''
      ? existingWorkoutId
      : undefined;

  // 3. Call the use case.
  try {
    const result = await startWorkoutUseCase.execute({
      userId: user.id,
      routineDayId,
      existingWorkoutId: trimmedExistingId,
    });
    return redirect(`/workout/${result.workout.id}`, 303);
  } catch (err) {
    if (err instanceof WorkoutNotFoundError) {
      return new Response('Bad request: workout not found', { status: 400 });
    }
    if (err instanceof InvalidRoutineDayError) {
      return new Response('Bad request: invalid routine_day_id', { status: 400 });
    }
    if (err instanceof WorkoutOwnershipError) {
      return new Response('Forbidden: workout belongs to another user', {
        status: 403,
      });
    }
    // Unknown error — let Astro's default error handler take it (500).
    throw err;
  }
};
