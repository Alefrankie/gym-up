// src/lib/contexts/progress/domain/progress.types.ts
//
// Domain types for the Progress context.
//
// Per docs/architecture/contexts/progress/readme.md "Entities" + "Value Objects".
// All types are derived from workout-tracking data (no separate persistence).
//
// Per ADR-006: `weight` and `volume` are stored in KG. Display conversion
// (kg → lbs) happens at the UI layer (page), not here.

import type { DateRange } from './progress.constants';

/**
 * One aggregated data point per calendar day for a given exercise.
 * - `weight` = max weight lifted that day (kg)
 * - `volume` = sum of (reps × weight) for all sets of the exercise that day (kg)
 *
 * Per architecture readme invariant: weight is max-per-day, volume is sum-per-day.
 * Per Q5 user decision: volume is `Σ(reps × weight)`, NOT `set_number × reps × weight`.
 */
export interface ChartDataPoint {
  date: string; // YYYY-MM-DD (UTC, calendar day)
  weight: number; // kg
  volume: number; // kg
}

/**
 * Current consecutive workout days + total all-time workouts.
 * Per architecture readme.
 */
export interface Streak {
  current: number; // consecutive days ending today (or yesterday if no workout today)
  total: number; // all-time completed workouts
}

/**
 * One calendar day. `hasWorkout` is binary (true if any completed workout exists that day).
 * Per architecture readme.
 */
export interface CalendarDay {
  date: string; // YYYY-MM-DD (UTC)
  hasWorkout: boolean;
}

// ---------- Use case inputs ----------

export interface GetExerciseListInput {
  userId: string;
}

export interface GetExerciseHistoryInput {
  userId: string;
  exerciseId: string;
  range: DateRange;
}

export interface GetCalendarDataInput {
  userId: string;
  /** Number of past days to return (default 28 per CalendarRules). */
  days?: number;
}

export interface GetStreakInput {
  userId: string;
}
