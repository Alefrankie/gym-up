// src/lib/contexts/progress/infrastructure/supabase/supabase-progress.repository.ts
//
// Supabase-backed implementation of ProgressRepository (story 6.2).
//
// Per ADR-004 (read-all on workouts / workout_entries): no ownership guard —
// the use-case layer enforces the userId scope. RLS allows read-all.
// Per ADR-006: weights are returned in KG. No conversion here.
// Per golden-rules (Cross-Context Isolation): reads from the same tables
// as workout-tracking but does NOT import any workout-tracking repository.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarDay, Streak } from '../../domain/progress.types';
import {
  type ProgressRepository,
  type RawEntry,
} from '../../domain/ports/ProgressRepository';

interface EntryRow {
  workout_date: string; // DATE → 'YYYY-MM-DD'
  reps: number;
  weight: number;
}

/** 'YYYY-MM-DD' key in UTC. */
function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Date at UTC midnight from a 'YYYY-MM-DD' key. */
function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Midnight UTC of the current calendar day. */
function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Build the most-recent N date keys (oldest first → today last), in UTC.
 */
function lastNDateKeys(n: number): string[] {
  const today = startOfTodayUtc();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(toDateKey(new Date(today.getTime() - i * 86_400_000)));
  }
  return out;
}

export class SupabaseProgressRepository implements ProgressRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getExerciseHistory(
    userId: string,
    exerciseId: string,
    since: Date | null,
  ): Promise<RawEntry[]> {
    let query = this.supabase
      .from('workout_entries')
      .select('workouts(workout_date), reps, weight')
      .eq('workouts.user_id', userId)
      .eq('workouts.status', 'completed')
      .eq('exercise_id', exerciseId)
      .eq('completed', true)
      .order('workouts.workout_date', { ascending: true });

    if (since) {
      query = query.gte('workouts.workout_date', toDateKey(since));
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch exercise history: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const r = row as {
        workouts: { workout_date: string } | { workout_date: string }[];
        reps: number;
        weight: number;
      };
      const workout = Array.isArray(r.workouts) ? r.workouts[0] : r.workouts;
      return {
        workoutDate: fromDateKey(workout?.workout_date ?? '1970-01-01'),
        reps: r.reps,
        weight: r.weight,
      };
    });
  }

  async getCalendarData(userId: string, days: number): Promise<CalendarDay[]> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('workout_date')
      .eq('user_id', userId)
      .eq('status', 'completed');
    if (error) {
      throw new Error(`Failed to fetch calendar data: ${error.message}`);
    }

    const workoutDates = new Set(
      (data ?? []).map((r) => (r as { workout_date: string }).workout_date),
    );

    return lastNDateKeys(days).map((date) => ({
      date,
      hasWorkout: workoutDates.has(date),
    }));
  }

  async getStreak(userId: string): Promise<Streak> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('workout_date')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('workout_date', { ascending: true });
    if (error) {
      throw new Error(`Failed to fetch streak data: ${error.message}`);
    }

    const dates = (data ?? []).map((r) => (r as { workout_date: string }).workout_date);
    const total = dates.length;

    if (total === 0) {
      return { current: 0, total: 0 };
    }

    const dateSet = new Set(dates);
    const today = startOfTodayUtc();
    const yesterday = new Date(today.getTime() - 86_400_000);

    // Streak counts back from today (or yesterday if no workout today).
    let cursor: Date | null = null;
    if (dateSet.has(toDateKey(today))) {
      cursor = today;
    } else if (dateSet.has(toDateKey(yesterday))) {
      cursor = yesterday;
    }
    if (cursor === null) {
      return { current: 0, total };
    }

    let current = 0;
    while (dateSet.has(toDateKey(cursor))) {
      current++;
      cursor = new Date(cursor.getTime() - 86_400_000);
    }
    return { current, total };
  }
}