// src/pages/api/workouts/[id]/complete.ts
//
// POST endpoint for completing a workout. Hired by the "Finish workout"
// button on the workout page (story 2.6).
//
// Per docs/architecture/contexts/workout-tracking/flows/log-set.flow.md
// Step 7: "User taps 'Finish workout'. Client validates ≥1 entry exists.
// Updates `workouts.status = 'completed'`, sets `completed_at`. Redirects
// to summary." Per AC-2.6-09: cross-user → 403, unknown workoutId → 404,
// no entries → 400, missing session → 401.

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getSessionIdFromRequest } from '@/lib/auth/cookie-helpers';
import { completeWorkoutUseCase } from '@/lib/contexts/workout-tracking/workout-tracking.composition';
import {
  NoEntriesError,
} from '@/lib/contexts/workout-tracking/application/complete-workout.use-case';
import { WorkoutOwnershipError } from '@/lib/contexts/workout-tracking/domain/workout.repository';

export const POST: APIRoute = async ({ request, params, redirect }) => {
  // 1. Resolve session.
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) {
    return new Response('Unauthorized: no session', { status: 401 });
  }
  const user = await getAuthService().getCurrentUser(sessionId);
  if (!user) {
    return new Response('Unauthorized: invalid session', { status: 401 });
  }

  // 2. Resolve workoutId from the URL.
  const workoutId = params.id;
  if (typeof workoutId !== 'string' || workoutId === '') {
    return new Response('Bad request: missing workout id', { status: 400 });
  }

  // 3. Call the use case.
  try {
    await completeWorkoutUseCase.execute({ userId: user.id, workoutId });
    // 4. Redirect to the workout page (same URL). The page re-fetches
    // the workout (now status='completed') and renders the summary.
    return redirect(`/workout/${workoutId}`, 303);
  } catch (err) {
    if (err instanceof NoEntriesError) {
      return new Response(err.message, { status: 400 });
    }
    if (err instanceof WorkoutOwnershipError) {
      return new Response('Forbidden', { status: 403 });
    }
    // WorkoutNotFoundError is local to the use case — match by name.
    if (err instanceof Error && err.name === 'WorkoutNotFoundError') {
      return new Response('Workout not found', { status: 404 });
    }
    // Unknown error — let Astro handle as 500.
    throw err;
  }
};
