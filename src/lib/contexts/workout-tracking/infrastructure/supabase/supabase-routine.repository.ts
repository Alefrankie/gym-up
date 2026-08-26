// src/lib/contexts/workout-tracking/infrastructure/supabase/supabase-routine.repository.ts
//
// Supabase-backed implementation of RoutineRepository (aggregate root).
//
// Routines are seed data (ADR-003) — read-only at runtime. RLS allows
// read-all on routines/routine_days/routine_exercises/exercises; there are
// no write policies (clients cannot write). Per ADR-007 + ADR-011:
// `implements`, not `extends`.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Routine,
  RoutineDay,
  RoutineExercise,
  Exercise,
} from '@db/schema';
import {
  RoutineRepository,
  type RoutineDayWithExercises,
} from '@/lib/contexts/workout-tracking/domain/routine.repository';

interface RoutineRow {
  id: string;
  name: string;
  type: 'hombre' | 'mujer';
}

interface RoutineDayRow {
  id: string;
  routine_id: string;
  day_number: number;
  day_name: string;
  focus: string;
}

interface RoutineExerciseRow {
  id: string;
  routine_day_id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  exercise_order: number;
}

interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: string;
}

function toRoutine(row: RoutineRow): Routine {
  return { id: row.id, name: row.name, type: row.type };
}

function toRoutineDay(row: RoutineDayRow): RoutineDay {
  return {
    id: row.id,
    routineId: row.routine_id,
    dayNumber: row.day_number,
    dayName: row.day_name,
    focus: row.focus,
  };
}

function toRoutineExercise(row: RoutineExerciseRow): RoutineExercise {
  return {
    id: row.id,
    routineDayId: row.routine_day_id,
    exerciseId: row.exercise_id,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    exerciseOrder: row.exercise_order,
  };
}

function toExercise(row: ExerciseRow): Exercise {
  return { id: row.id, name: row.name, muscleGroup: row.muscle_group };
}

export class SupabaseRoutineRepository implements RoutineRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findAll(): Promise<Routine[]> {
    const { data, error } = await this.supabase
      .from('routines')
      .select('id, name, type')
      .order('type', { ascending: true });
    if (error) {
      throw new Error(`Failed to fetch routines: ${error.message}`);
    }
    return (data ?? []).map((row) => toRoutine(row as RoutineRow));
  }

  async findById(id: string): Promise<Routine | undefined> {
    const { data, error } = await this.supabase
      .from('routines')
      .select('id, name, type')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch routine ${id}: ${error.message}`);
    }
    if (!data) return undefined;
    return toRoutine(data as RoutineRow);
  }

  async findDayByTypeAndDayNumber(
    type: 'hombre' | 'mujer',
    dayNumber: number,
  ): Promise<RoutineDay | undefined> {
    // Join routine_days → routines to filter by routine type.
    const { data, error } = await this.supabase
      .from('routine_days')
      .select('id, routine_id, day_number, day_name, focus, routines!inner(type)')
      .eq('routines.type', type)
      .eq('day_number', dayNumber)
      .maybeSingle();
    if (error) {
      throw new Error(
        `Failed to fetch routine day (${type}, ${dayNumber}): ${error.message}`,
      );
    }
    if (!data) return undefined;
    return toRoutineDay(data as RoutineDayRow);
  }

  async findDayWithExercises(
    dayId: string,
  ): Promise<RoutineDayWithExercises | undefined> {
    const { data: day, error: dayError } = await this.supabase
      .from('routine_days')
      .select('id, routine_id, day_number, day_name, focus')
      .eq('id', dayId)
      .maybeSingle();
    if (dayError) {
      throw new Error(`Failed to fetch routine day ${dayId}: ${dayError.message}`);
    }
    if (!day) return undefined;

    const { data: slots, error: slotsError } = await this.supabase
      .from('routine_exercises')
      .select(
        'id, routine_day_id, exercise_id, target_sets, target_reps, exercise_order, exercises(id, name, muscle_group)',
      )
      .eq('routine_day_id', dayId)
      .order('exercise_order', { ascending: true });
    if (slotsError) {
      throw new Error(
        `Failed to fetch routine exercises for day ${dayId}: ${slotsError.message}`,
      );
    }

    const exercises = (slots ?? []).map((row) => {
      const slot = row as RoutineExerciseRow & {
        exercises: ExerciseRow | ExerciseRow[];
      };
      const exercise = Array.isArray(slot.exercises)
        ? slot.exercises[0]
        : slot.exercises;
      return {
        ...toRoutineExercise(slot),
        exercise: toExercise(exercise),
      };
    });

    return { day: toRoutineDay(day as RoutineDayRow), exercises };
  }
}