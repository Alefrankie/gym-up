// src/lib/contexts/public-view/infrastructure/supabase/supabase-public-workout.repository.ts
//
// Supabase-backed implementation of PublicWorkoutRepository (story 6.2).
// Per ADR-004: read-all — no ownership guard (RLS allows read-all).
// Per golden-rules (Cross-Context Isolation): reads directly from the
// workouts table, NOT via WorkoutRepository from workout-tracking context.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicWorkoutRepository } from '../../domain/public-workout.repository';

/** 'YYYY-MM-DD' key in UTC. */
function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Date at UTC midnight from a 'YYYY-MM-DD' key. */
function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export class SupabasePublicWorkoutRepository implements PublicWorkoutRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getCompletedCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');
    if (error) {
      throw new Error(`Failed to count completed workouts: ${error.message}`);
    }
    return count ?? 0;
  }

  async getLastWorkoutDate(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('workout_date')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('workout_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch last workout date: ${error.message}`);
    }
    if (!data) return null;
    return (data as { workout_date: string }).workout_date;
  }

  async getCompletedByUserId(
    userId: string,
  ): Promise<Array<{ id: string; workoutDate: Date }>> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('id, workout_date')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('workout_date', { ascending: true });
    if (error) {
      throw new Error(`Failed to fetch completed workouts: ${error.message}`);
    }
    return (data ?? []).map((row) => {
      const r = row as { id: string; workout_date: string };
      return { id: r.id, workoutDate: fromDateKey(r.workout_date) };
    });
  }
}