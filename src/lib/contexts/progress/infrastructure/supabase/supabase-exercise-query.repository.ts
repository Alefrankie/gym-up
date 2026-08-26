// src/lib/contexts/progress/infrastructure/supabase/supabase-exercise-query.repository.ts
//
// Supabase-backed implementation of ExerciseQueryRepository (story 6.2).
//
// Per architecture invariant: "Exercise selector shows ONLY exercises the
// user has actually logged" → query JOINs through workout_entries filtered
// by userId + status='completed' + completed=true.
// Per golden-rules (Cross-Context Isolation): queries the `exercises` table
// directly. Does NOT import any workout-tracking repository.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Exercise } from '@db/schema';
import { ExerciseQueryRepository } from '../../domain/ports/ExerciseQueryRepository';

interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: string;
}

export class SupabaseExerciseQueryRepository implements ExerciseQueryRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getLoggedExercises(userId: string): Promise<Exercise[]> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select(
        'id, name, muscle_group, workout_entries!inner(workouts!inner(user_id, status))',
      )
      .eq('workout_entries.workouts.user_id', userId)
      .eq('workout_entries.workouts.status', 'completed')
      .eq('workout_entries.completed', true)
      .order('name', { ascending: true });
    if (error) {
      throw new Error(`Failed to fetch logged exercises: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const r = row as ExerciseRow;
      return { id: r.id, name: r.name, muscleGroup: r.muscle_group };
    });
  }
}