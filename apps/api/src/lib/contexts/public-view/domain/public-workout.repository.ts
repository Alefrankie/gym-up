// src/lib/contexts/public-view/domain/public-workout.repository.ts
//
// Abstract port for reading workouts in the public view context.
// Per ADR-007: abstract class as port, concrete impl in infrastructure/.
// Per ADR-004: read-all — all authenticated users can read all workouts.
// Per golden-rules (Cross-Context Isolation): this repo reads directly
// from the workouts/workout_entries tables via SQL, NOT via WorkoutRepository
// from workout-tracking context.

export abstract class PublicWorkoutRepository {
  /**
   * Count completed workouts for a given user.
   * Only counts workouts with status='completed' (not in_progress).
   */
  abstract getCompletedCount(userId: string): Promise<number>;

  /**
   * Get the date of the most recent completed workout for a user.
   * Returns ISO date string (YYYY-MM-DD) or null if no completed workouts.
   */
  abstract getLastWorkoutDate(userId: string): Promise<string | null>;

  /**
   * Fetch all completed workouts for a user (id + date).
   * Used by /family/[user_id] for calendar rendering.
   * Ordered by workoutDate ASC (oldest first).
   */
  abstract getCompletedByUserId(
    userId: string,
  ): Promise<Array<{ id: string; workoutDate: Date }>>;
}
