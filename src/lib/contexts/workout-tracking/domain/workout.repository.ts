// src/lib/contexts/workout-tracking/domain/workout.repository.ts
//
// Abstract contract for workout persistence.
//
// Per ADR-007 + ADR-011: concrete classes `implements` this abstract class.
// Per ADR-004 (write-own / read-all): `update` and `delete` take a
// `currentUserId` and throw if the row belongs to a different user.
// Reads (find*) do NOT filter by userId — the public view lets every
// family member see everyone else's workouts.

import type {
  Workout,
  NewWorkout,
  WorkoutEntry,
  NewWorkoutEntry,
} from '@db/schema';

/**
 * Patch type for `update()`. Only mutable fields are exposed
 * (status + completedAt are set via dedicated semantics, not arbitrary
 * patches, to keep the aggregate's invariants simple).
 */
export type WorkoutUpdate = Partial<
  Pick<Workout, 'status' | 'completedAt'>
>;

/**
 * Thrown when a write-own guard rejects a call because the row's owner
 * does not match `currentUserId`. Components should treat this as a
 * permission error and not retry.
 */
export class WorkoutOwnershipError extends Error {
  constructor(
    public readonly workoutId: string,
    public readonly currentUserId: string,
  ) {
    super(
      `Workout ${workoutId} does not belong to user ${currentUserId}`,
    );
    this.name = 'WorkoutOwnershipError';
  }
}

export abstract class WorkoutRepository {
  /**
   * Look up a workout by id. Read-all (no userId filter).
   * Returns `undefined` if not found.
   */
  abstract findById(id: string): Promise<Workout | undefined>;

  /**
   * Find the workout for a user on a given date (start-workout flow step 3).
   * `date` is a millisecond timestamp (matches `workouts.workout_date`).
   * Returns `undefined` if no workout exists for that day.
   */
  abstract findByUserAndDate(
    userId: string,
    date: Date,
  ): Promise<Workout | undefined>;

  /**
   * Find any in-progress workout for a user (used for "resume"
   * functionality on the dashboard).
   */
  abstract findInProgressByUser(userId: string): Promise<Workout | undefined>;

  /**
   * Create a new workout. Throws on FK violation (e.g. unknown
   * routine_day_id) or uniqueness conflict (one workout per user/date).
   */
  abstract create(input: NewWorkout): Promise<Workout>;

  /**
   * Update a workout's status / completedAt. Throws `WorkoutOwnershipError`
   * if the workout belongs to a different user (write-own per ADR-004).
   * Throws a generic Error if the workout does not exist.
   */
  abstract update(
    id: string,
    patch: WorkoutUpdate,
    currentUserId: string,
  ): Promise<Workout>;

  /**
   * Delete a workout (cascades to workout_entries via FK). Throws
   * `WorkoutOwnershipError` on cross-user attempts.
   */
  abstract delete(id: string, currentUserId: string): Promise<void>;

  /**
   * Append a workout_entry (set log) to a workout. Throws
   * `WorkoutOwnershipError` if the workout belongs to a different user.
   * Used by the log-set flow (auto-save on checkmark). The `workoutId`
   * parameter is set explicitly from the function argument; the `input`
   * type omits `workoutId` so callers can't accidentally pass a
   * different value.
   */
  abstract addEntry(
    workoutId: string,
    input: Omit<NewWorkoutEntry, 'workoutId'>,
    currentUserId: string,
  ): Promise<WorkoutEntry>;

  /**
   * List all entries for a workout, ordered by (exercise_id, set_number).
   * Read-all (no ownership check).
   */
  abstract findEntries(workoutId: string): Promise<WorkoutEntry[]>;

  /**
   * Update a workout entry's mutable fields. Throws `WorkoutOwnershipError`
   * if the entry belongs to a different user. Throws a generic Error if the
   * entry does not exist. Used by `LogSetUseCase` for the upsert path
   * (story 2.4).
   */
  abstract updateEntry(
    id: string,
    patch: WorkoutEntryPatch,
    currentUserId: string,
  ): Promise<WorkoutEntry>;
}

/**
 * Patch type for `updateEntry()`. Only mutable fields are exposed
 * (the id, workoutId, exerciseId, and setNumber are immutable — they
 * define the entry's identity).
 */
export type WorkoutEntryPatch = Partial<
  Pick<WorkoutEntry, 'reps' | 'weight' | 'completed' | 'notes'>
>;

