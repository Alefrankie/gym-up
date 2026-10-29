// src/lib/contexts/progress/domain/ports/ProgressRepository.ts
//
// Abstract port for progress-related reads. Per ADR-007.
// The concrete impl lives in `infrastructure/sqlite/sqlite-progress.repository.ts`.
//
// Per golden-rules (Cross-Context Isolation): the SQLite impl reads from
// workout-tracking tables (workouts, workout_entries) via SQL — it does
// NOT import any workout-tracking repository. The data is shared at the
// schema level, not at the bounded-context level.
//
// Per ADR-006: weights are returned in KG. Display conversion at the UI layer.

import type { CalendarDay, Streak } from '../progress.types';

/**
 * Raw row shape returned by `getExerciseHistory`. The use case
 * aggregates these into `ChartDataPoint[]` (one per calendar day).
 */
export interface RawEntry {
  workoutDate: Date;
  reps: number;
  weight: number; // kg
}

export abstract class ProgressRepository {
  /**
   * Fetch all completed-workout entries for the given user + exercise,
   * optionally filtered by `since` (inclusive lower bound on workoutDate).
   * `since === null` means "all time".
   * Ordered by `workoutDate ASC` (oldest first) so the use case can
   * stream-friendly aggregate.
   */
  abstract getExerciseHistory(
    userId: string,
    exerciseId: string,
    since: Date | null,
  ): Promise<RawEntry[]>;

  /**
   * Fetch `days` calendar days (most recent), each annotated with
   * whether a completed workout occurred that day. Used by the
   * calendar grid (story 3.3, port defined here per readme).
   */
  abstract getCalendarData(
    userId: string,
    days: number,
  ): Promise<CalendarDay[]>;

  /**
   * Count consecutive workout days ending today (or yesterday if no
   * workout today) + total all-time completed workouts.
   */
  abstract getStreak(userId: string): Promise<Streak>;
}
