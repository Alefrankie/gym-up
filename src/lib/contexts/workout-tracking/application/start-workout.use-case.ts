// src/lib/contexts/workout-tracking/application/start-workout.use-case.ts
//
// Use case: start a new workout, or resume an existing one (Continue path).
//
// Per docs/architecture/contexts/workout-tracking/readme.md Use Cases table
// (StartWorkoutUseCase — was "planned", now implemented for story 2.2).
// Per docs/architecture/contexts/workout-tracking/flows/start-workout.flow.md
// (Steps 4-5 of the happy path).
//
// Returns a discriminated union so the caller can distinguish a freshly
// created workout from a resumed one (useful for telemetry, redirects, and
// UI affordances). Idempotency is built in for the Start path: if a workout
// already exists for the user today, the existing one is returned without
// a second insert. The race condition (two concurrent inserts) is handled
// by catching the SQLite UNIQUE constraint error and re-querying.

import type { Workout } from '@db/schema';
import {
  WorkoutOwnershipError,
  type WorkoutRepository,
} from '../domain/workout.repository';
import type { RoutineRepository } from '../domain/routine.repository';

export interface StartWorkoutInput {
  userId: string;
  routineDayId: string;
  /**
   * If provided, the call is treated as "Continue" — the use case verifies
   * ownership of the existing workout and returns it. No new insert.
   */
  existingWorkoutId?: string;
  /**
   * Injectable "now" — used by tests to make the date-scoped check
   * deterministic. Production callers should leave this unset.
   * Skill rule (from 2.1): "now: Date for date-dependent use cases".
   */
  now?: Date;
}

export type StartWorkoutResult =
  | { kind: 'started'; workout: Workout }
  | { kind: 'resumed'; workout: Workout };

/**
 * Thrown when the caller passes an `existingWorkoutId` that does not
 * correspond to any workout in the database.
 */
export class WorkoutNotFoundError extends Error {
  constructor(public readonly workoutId: string) {
    super(`Workout not found: ${workoutId}`);
    this.name = 'WorkoutNotFoundError';
  }
}

/**
 * Thrown when the `routineDayId` does not correspond to any routine_day
 * in the database. The SQLite FK violation is translated into this
 * domain error so the API endpoint can map it to HTTP 400.
 */
export class InvalidRoutineDayError extends Error {
  constructor(public readonly routineDayId: string) {
    super(`Invalid routine_day_id: ${routineDayId}`);
    this.name = 'InvalidRoutineDayError';
  }
}

/**
 * Detect SQLite UNIQUE constraint error. Message format:
 *   "UNIQUE constraint failed: workouts.user_id, workouts.workout_date, workouts.routine_day_id"
 * We match the prefix for portability across SQLite driver versions.
 */
export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

/**
 * Detect SQLite FOREIGN KEY constraint error. Message format:
 *   "FOREIGN KEY constraint failed"
 */
export function isForeignKeyConstraintError(err: unknown): boolean {
  return err instanceof Error && /FOREIGN KEY constraint failed/i.test(err.message);
}

export class StartWorkoutUseCase {
  constructor(
    private readonly routineRepository: RoutineRepository,
    private readonly workoutRepository: WorkoutRepository,
  ) {}

  async execute(input: StartWorkoutInput): Promise<StartWorkoutResult> {
    // Continue path: verify ownership of the existing workout.
    if (input.existingWorkoutId) {
      const existing = await this.workoutRepository.findById(input.existingWorkoutId);
      if (!existing) {
        throw new WorkoutNotFoundError(input.existingWorkoutId);
      }
      if (existing.userId !== input.userId) {
        throw new WorkoutOwnershipError(input.existingWorkoutId, input.userId);
      }
      return { kind: 'resumed', workout: existing };
    }

    // Start path with idempotency (AC-2.2-04).
    const now = input.now ?? new Date();
    const existingToday = await this.workoutRepository.findByUserAndDate(
      input.userId,
      now,
    );
    if (existingToday) {
      return { kind: 'resumed', workout: existingToday };
    }

    try {
      const workout = await this.workoutRepository.create({
        userId: input.userId,
        routineDayId: input.routineDayId,
        workoutDate: now,
        status: 'in_progress',
      });
      return { kind: 'started', workout };
    } catch (err) {
      // Race condition: another request inserted between our
      // findByUserAndDate and our create. Catch the UNIQUE violation and
      // re-query for the winning workout.
      if (isUniqueConstraintError(err)) {
        const winner = await this.workoutRepository.findByUserAndDate(
          input.userId,
          now,
        );
        if (winner) {
          return { kind: 'resumed', workout: winner };
        }
      }
      // FK violation: routineDayId does not exist. Map to a typed error.
      if (isForeignKeyConstraintError(err)) {
        throw new InvalidRoutineDayError(input.routineDayId);
      }
      throw err;
    }
  }
}
