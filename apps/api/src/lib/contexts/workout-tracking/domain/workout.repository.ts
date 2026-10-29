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
import type { WorkoutStatus } from './workout-tracking.constants';

/**
 * History list item (story 3.1). Derived from a workout + routine_day
 * + a sum/count over its entries. Returned by `getHistoryByUser` so
 * the page can render the list without an N+1 query per row.
 */
export interface WorkoutHistoryItem {
  id: string;
  workoutDate: Date;
  routineDayName: string;
  exerciseCount: number;
  totalVolume: number; // kg — Σ(reps × weight) over completed entries (matches WorkoutSummary per Q4)
  status: WorkoutStatus;
}

/**
 * Detail entry enriched with exercise metadata (story 3.1). Returned
 * by `getEntriesWithExercises` so the expanded detail panel can show
 * the exercise name + muscle group alongside the set data. Ordered
 * by (exercise_id, set_number) — same as `findEntries`.
 */
export interface WorkoutDetailEntry {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  setNumber: number;
  reps: number;
  weight: number; // kg
  completed: boolean;
  notes: string | null;
}

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

  /**
   * Get a paginated slice of the user's workout history, ordered by
   * `workout_date` DESC (newest first). Returns denormalized items
   * (with `routineDayName`, `exerciseCount`, `totalVolume`) so the
   * history page can render a list without an N+1 query per row.
   * Includes both `in_progress` and `completed` workouts (Q2).
   *
   * Per ADR-004: this is user-scoped (read-own) — the history list
   * only shows the requesting user's workouts. The `findById` family
   * view (read-all) is preserved for the detail panel's ownership
   * guard at the use-case layer.
   */
  abstract getHistoryByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<WorkoutHistoryItem[]>;

  /**
   * Total count of workouts for a user (for pagination metadata).
   * Same scope as `getHistoryByUser` (user-scoped).
   */
  abstract getHistoryCountByUser(userId: string): Promise<number>;

  /**
   * List all entries for a workout with exercise metadata joined in
   * (name + muscleGroup). Ordered by (exercise_id, set_number) — same
   * as `findEntries`. Used by the history detail panel.
   * Read-all (no ownership check; the use case guards `userId`).
   */
  abstract getEntriesWithExercises(
    workoutId: string,
  ): Promise<WorkoutDetailEntry[]>;
}

/**
 * Patch type for `updateEntry()`. Only mutable fields are exposed
 * (the id, workoutId, exerciseId, and setNumber are immutable — they
 * define the entry's identity).
 */
export type WorkoutEntryPatch = Partial<
  Pick<WorkoutEntry, 'reps' | 'weight' | 'completed' | 'notes'>
>;

