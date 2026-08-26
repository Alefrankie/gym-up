// src/lib/contexts/workout-tracking/infrastructure/supabase/supabase-workout.repository.ts
//
// Supabase-backed implementation of WorkoutRepository (story 6.2).
//
// Per ADR-004 (write-own / read-all): RLS enforces the write-own on
// workouts/workout_entries. The repo does NOT inject `user_id` filters for
// reads (read-all). For writes, the repo still performs a read-then-check
// so it can throw the typed `WorkoutOwnershipError` on cross-user attempts
// (RLS alone would silently return 0 rows — the contract requires the
// specific error). RLS remains defense-in-depth.
//
// Per ADR-006: `addEntry` does NOT convert weight — callers pass kg.
// Per ADR-007 + ADR-011: `implements`, not `extends`.
//
// DATE semantics: Postgres `workouts.workout_date` is DATE (YYYY-MM-DD);
// the TS `Workout.workoutDate` is a Date (SQLite timestamp_ms). The repo
// converts at the boundary (UTC midnight).

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  NewWorkout,
  NewWorkoutEntry,
  Workout,
  WorkoutEntry,
} from '@db/schema';
import {
  WorkoutOwnershipError,
  WorkoutRepository,
  type WorkoutDetailEntry,
  type WorkoutEntryPatch,
  type WorkoutHistoryItem,
  type WorkoutUpdate,
} from '@/lib/contexts/workout-tracking/domain/workout.repository';

interface WorkoutRow {
  id: string;
  user_id: string;
  routine_day_id: string;
  workout_date: string; // DATE → 'YYYY-MM-DD'
  status: 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
}

interface WorkoutEntryRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  completed: boolean;
  notes: string | null;
  created_at: string;
}

/** 'YYYY-MM-DD' key in UTC. */
function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Date at UTC midnight from a 'YYYY-MM-DD' key. */
function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function toWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    userId: row.user_id,
    routineDayId: row.routine_day_id,
    workoutDate: fromDateKey(row.workout_date),
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at) : new Date(0),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

function toWorkoutEntry(row: WorkoutEntryRow): WorkoutEntry {
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id,
    setNumber: row.set_number,
    reps: row.reps,
    weight: row.weight,
    completed: row.completed,
    notes: row.notes,
    createdAt: new Date(row.created_at),
  };
}

export class SupabaseWorkoutRepository implements WorkoutRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<Workout | undefined> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch workout ${id}: ${error.message}`);
    }
    if (!data) return undefined;
    return toWorkout(data as WorkoutRow);
  }

  async findByUserAndDate(
    userId: string,
    date: Date,
  ): Promise<Workout | undefined> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('workout_date', toDateKey(date))
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch workout for user ${userId}: ${error.message}`);
    }
    if (!data) return undefined;
    return toWorkout(data as WorkoutRow);
  }

  async findInProgressByUser(userId: string): Promise<Workout | undefined> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch in-progress workout: ${error.message}`);
    }
    if (!data) return undefined;
    return toWorkout(data as WorkoutRow);
  }

  async create(input: NewWorkout): Promise<Workout> {
    const { data, error } = await this.supabase
      .from('workouts')
      .insert({
        user_id: input.userId,
        routine_day_id: input.routineDayId,
        workout_date: toDateKey(input.workoutDate ?? new Date()),
        ...(input.status && { status: input.status }),
        ...(input.startedAt && { started_at: input.startedAt.toISOString() }),
        ...(input.completedAt && { completed_at: input.completedAt.toISOString() }),
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to create workout: ${error.message}`);
    }
    return toWorkout(data as WorkoutRow);
  }

  async update(
    id: string,
    patch: WorkoutUpdate,
    currentUserId: string,
  ): Promise<Workout> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Workout not found: ${id}`);
    }
    if (existing.userId !== currentUserId) {
      throw new WorkoutOwnershipError(id, currentUserId);
    }

    const { data, error } = await this.supabase
      .from('workouts')
      .update({
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.completedAt !== undefined && {
          completed_at: patch.completedAt
            ? patch.completedAt.toISOString()
            : null,
        }),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to update workout ${id}: ${error.message}`);
    }
    return toWorkout(data as WorkoutRow);
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Workout not found: ${id}`);
    }
    if (existing.userId !== currentUserId) {
      throw new WorkoutOwnershipError(id, currentUserId);
    }

    const { error } = await this.supabase
      .from('workouts')
      .delete()
      .eq('id', id);
    if (error) {
      throw new Error(`Failed to delete workout ${id}: ${error.message}`);
    }
  }

  async addEntry(
    workoutId: string,
    input: Omit<NewWorkoutEntry, 'workoutId'>,
    currentUserId: string,
  ): Promise<WorkoutEntry> {
    const workout = await this.findById(workoutId);
    if (!workout) {
      throw new Error(`Workout not found: ${workoutId}`);
    }
    if (workout.userId !== currentUserId) {
      throw new WorkoutOwnershipError(workoutId, currentUserId);
    }

    const { data, error } = await this.supabase
      .from('workout_entries')
      .insert({
        workout_id: workoutId,
        exercise_id: input.exerciseId,
        set_number: input.setNumber,
        reps: input.reps,
        weight: input.weight,
        completed: input.completed,
        notes: input.notes ?? null,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to add workout entry: ${error.message}`);
    }
    return toWorkoutEntry(data as WorkoutEntryRow);
  }

  async findEntries(workoutId: string): Promise<WorkoutEntry[]> {
    const { data, error } = await this.supabase
      .from('workout_entries')
      .select('*')
      .eq('workout_id', workoutId)
      .order('exercise_id', { ascending: true })
      .order('set_number', { ascending: true });
    if (error) {
      throw new Error(`Failed to fetch entries for workout ${workoutId}: ${error.message}`);
    }
    return (data ?? []).map((row) => toWorkoutEntry(row as WorkoutEntryRow));
  }

  async updateEntry(
    id: string,
    patch: WorkoutEntryPatch,
    currentUserId: string,
  ): Promise<WorkoutEntry> {
    const { data: entryRow, error: entryError } = await this.supabase
      .from('workout_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (entryError) {
      throw new Error(`Failed to fetch workout entry ${id}: ${entryError.message}`);
    }
    if (!entryRow) {
      throw new Error(`Workout entry not found: ${id}`);
    }
    const entry = toWorkoutEntry(entryRow as WorkoutEntryRow);

    const workout = await this.findById(entry.workoutId);
    if (!workout) {
      throw new Error(`Workout not found: ${entry.workoutId}`);
    }
    if (workout.userId !== currentUserId) {
      throw new WorkoutOwnershipError(entry.workoutId, currentUserId);
    }

    const { data, error } = await this.supabase
      .from('workout_entries')
      .update({
        ...(patch.reps !== undefined && { reps: patch.reps }),
        ...(patch.weight !== undefined && { weight: patch.weight }),
        ...(patch.completed !== undefined && { completed: patch.completed }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to update workout entry ${id}: ${error.message}`);
    }
    return toWorkoutEntry(data as WorkoutEntryRow);
  }

  async getHistoryByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<WorkoutHistoryItem[]> {
    // Fetch workouts with embedded routine_day name + entries, then
    // aggregate exerciseCount / totalVolume in JS (Supabase JS cannot
    // express COUNT(DISTINCT) / conditional SUM over a join).
    const { data, error } = await this.supabase
      .from('workouts')
      .select(
        'id, workout_date, status, routine_days(day_name), workout_entries(exercise_id, reps, weight, completed)',
      )
      .eq('user_id', userId)
      .order('workout_date', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      throw new Error(`Failed to fetch workout history: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const w = row as WorkoutRow & {
        routine_days: { day_name: string } | { day_name: string }[];
        workout_entries: Array<{
          exercise_id: string;
          reps: number;
          weight: number;
          completed: boolean;
        }>;
      };
      const dayName = Array.isArray(w.routine_days)
        ? w.routine_days[0]?.day_name
        : w.routine_days?.day_name;
      const entries = w.workout_entries ?? [];
      const exerciseIds = new Set(entries.map((e) => e.exercise_id));
      const totalVolume = entries.reduce(
        (sum, e) => (e.completed ? sum + e.reps * e.weight : sum),
        0,
      );
      return {
        id: w.id,
        workoutDate: fromDateKey(w.workout_date),
        routineDayName: dayName ?? '',
        exerciseCount: exerciseIds.size,
        totalVolume,
        status: w.status,
      };
    });
  }

  async getHistoryCountByUser(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) {
      throw new Error(`Failed to count workouts: ${error.message}`);
    }
    return count ?? 0;
  }

  async getEntriesWithExercises(
    workoutId: string,
  ): Promise<WorkoutDetailEntry[]> {
    const { data, error } = await this.supabase
      .from('workout_entries')
      .select(
        'id, exercise_id, set_number, reps, weight, completed, notes, exercises(name, muscle_group)',
      )
      .eq('workout_id', workoutId)
      .order('exercise_id', { ascending: true })
      .order('set_number', { ascending: true });
    if (error) {
      throw new Error(`Failed to fetch entries with exercises: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const r = row as WorkoutEntryRow & {
        exercises: { name: string; muscle_group: string } | { name: string; muscle_group: string }[];
      };
      const exercise = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises;
      return {
        id: r.id,
        exerciseId: r.exercise_id,
        exerciseName: exercise?.name ?? '',
        muscleGroup: exercise?.muscle_group ?? '',
        setNumber: r.set_number,
        reps: r.reps,
        weight: r.weight,
        completed: r.completed,
        notes: r.notes,
      };
    });
  }
}