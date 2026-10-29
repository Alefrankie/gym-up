// src/lib/contexts/workout-tracking/application/complete-workout.use-case.ts
//
// Use case: mark a workout as completed.
//
// Per docs/architecture/contexts/workout-tracking/readme.md Use Cases
// table (CompleteWorkoutUseCase — was "planned", now implemented for
// story 2.6). Per docs/architecture/contexts/workout-tracking/flows/
// log-set.flow.md Step 7: "User taps 'Finish workout'. Client validates
// ≥1 entry exists. Updates `workouts.status = 'completed'`, sets
// `completed_at`. Redirects to summary."
//
// Per FR-WT-012 + AC-2.6-05: re-completion is allowed. The use case
// re-sets `status` + `completedAt` to the current values. Entries are
// preserved (for history, future charts).
//
// Per AC-2.6-06: throws `NoEntriesError` if the workout has no entries.
// Per AC-2.6-07: accepts a `now?: Date` field for testability (skill rule
// from 2.1 — "now: Date for date-dependent use cases").
// Per AC-2.6-09: cross-user → `WorkoutOwnershipError`; unknown workoutId →
// `WorkoutNotFoundError`.

import {
  WorkoutOwnershipError,
  type WorkoutRepository,
} from '../domain/workout.repository';
import type { Workout } from '@db/schema';

export interface CompleteWorkoutInput {
  userId: string;
  workoutId: string;
  /** Injectable "now" — used by tests to make `completedAt` deterministic. */
  now?: Date;
}

export interface CompleteWorkoutResult {
  workout: Workout;
}

/**
 * Thrown when the workout does not exist in the database. The endpoint
 * maps this to HTTP 404. Defined locally in this use case (the domain
 * repo doesn't export this error class — it's owned per use case).
 */
export class WorkoutNotFoundError extends Error {
  constructor(public readonly workoutId: string) {
    super(`Workout not found: ${workoutId}`);
    this.name = 'WorkoutNotFoundError';
  }
}

/**
 * Thrown when the workout has no entries. The endpoint maps this to
 * HTTP 400 with the message "Log at least one set before finishing".
 */
export class NoEntriesError extends Error {
  constructor(public readonly workoutId: string) {
    super('Log at least one set before finishing');
    this.name = 'NoEntriesError';
  }
}

export class CompleteWorkoutUseCase {
  constructor(private readonly workoutRepository: WorkoutRepository) {}

  async execute(input: CompleteWorkoutInput): Promise<CompleteWorkoutResult> {
    // 1. Verify workout ownership.
    const workout = await this.workoutRepository.findById(input.workoutId);
    if (!workout) {
      throw new WorkoutNotFoundError(input.workoutId);
    }
    if (workout.userId !== input.userId) {
      throw new WorkoutOwnershipError(input.workoutId, input.userId);
    }

    // 2. Validate ≥1 entry exists (AC-2.6-06).
    const entries = await this.workoutRepository.findEntries(input.workoutId);
    if (entries.length === 0) {
      throw new NoEntriesError(input.workoutId);
    }

    // 3. Update workout status to 'completed' and set completedAt.
    const now = input.now ?? new Date();
    const updated = await this.workoutRepository.update(
      input.workoutId,
      { status: 'completed', completedAt: now },
      input.userId,
    );

    return { workout: updated };
  }
}
