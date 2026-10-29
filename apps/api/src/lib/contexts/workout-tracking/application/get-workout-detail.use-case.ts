// src/lib/contexts/workout-tracking/application/get-workout-detail.use-case.ts
//
// Use case: fetch a single workout with all entries enriched with
// exercise metadata (name, muscle_group).
//
// Per docs/architecture/contexts/workout-tracking/readme.md Use Cases
// table (GetWorkoutDetailUseCase — was "planned", now implemented for
// story 3.1). Per AC-3.1-04: tap entry → expand for full set detail.
//
// Per ADR-004 (read-all on findById): the use case enforces ownership
// guard at this layer — throws `WorkoutAccessDeniedError` if
// `workout.userId !== userId`. The repo remains read-all for the
// family-view use cases (dashboard, future family page).
//
// Per edge case: returns empty entries array for in-progress workout
// with 0 entries (does NOT throw). The detail panel renders
// "Aún no hay sets" instead.

import type { Workout } from '@db/schema';
import type {
  WorkoutDetailEntry,
  WorkoutRepository,
} from '../domain/workout.repository';

export interface GetWorkoutDetailInput {
  userId: string;
  workoutId: string;
}

export interface GetWorkoutDetailResult {
  workout: Workout;
  entries: WorkoutDetailEntry[];
}

/**
 * Thrown when the workoutId does not exist in the database.
 * The page/API maps this to HTTP 404.
 */
export class WorkoutNotFoundError extends Error {
  constructor(public readonly workoutId: string) {
    super(`Workout not found: ${workoutId}`);
    this.name = 'WorkoutNotFoundError';
  }
}

/**
 * Thrown when the workout exists but belongs to a different user.
 * The page/API maps this to HTTP 403.
 */
export class WorkoutAccessDeniedError extends Error {
  constructor(
    public readonly workoutId: string,
    public readonly currentUserId: string,
  ) {
    super(
      `Access denied to workout ${workoutId} for user ${currentUserId}`,
    );
    this.name = 'WorkoutAccessDeniedError';
  }
}

export class GetWorkoutDetailUseCase {
  constructor(private readonly workoutRepository: WorkoutRepository) {}

  async execute(
    input: GetWorkoutDetailInput,
  ): Promise<GetWorkoutDetailResult> {
    // 1. Find workout (read-all per ADR-004 family view).
    const workout = await this.workoutRepository.findById(input.workoutId);
    if (!workout) {
      throw new WorkoutNotFoundError(input.workoutId);
    }

    // 2. Ownership guard: history detail is user-scoped (the user only
    // sees their own history), so we throw if the workout belongs to
    // a different user. This guard lives at the use-case layer to
    // preserve `findById`'s read-all contract for other use cases.
    if (workout.userId !== input.userId) {
      throw new WorkoutAccessDeniedError(
        input.workoutId,
        input.userId,
      );
    }

    // 3. Fetch entries with exercise metadata (single JOIN query).
    // Returns an empty array if the workout has no entries yet
    // (e.g., just-started in-progress workout) — the page handles
    // the empty state, not an error.
    const entries = await this.workoutRepository.getEntriesWithExercises(
      input.workoutId,
    );

    return { workout, entries };
  }
}
