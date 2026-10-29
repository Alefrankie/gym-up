// src/lib/contexts/workout-tracking/domain/workout-tracking.types.ts
//
// Domain types (DTOs, value objects) for the workout-tracking context.
// Mirrors the parent spec (docs/architecture/contexts/workout-tracking/readme.md)
// and the schema (@db/schema.ts) without coupling directly to Drizzle's
// inferred types so application code stays free of ORM imports.

import type { RoutineType, WorkoutStatus } from './workout-tracking.constants';

export interface Workout {
  id: string;
  userId: string;
  routineDayId: string;
  workoutDate: string;
  status: WorkoutStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface WorkoutEntry {
  id: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number; // kg
  completed: boolean;
  notes: string | null;
}

export interface Routine {
  id: string;
  name: string;
  type: RoutineType;
}

export interface RoutineDay {
  id: string;
  routineId: string;
  dayNumber: number;
  dayName: string;
  focus: string;
}

export interface RoutineExercise {
  id: string;
  routineDayId: string;
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  exerciseOrder: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
}

export interface WorkoutCreateDTO {
  userId: string;
  routineDayId: string;
  workoutDate: string;
}

export interface WorkoutUpdateDTO {
  status?: WorkoutStatus;
  completedAt?: string | null;
}

export interface WorkoutEntryUpsertDTO {
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number; // kg
  completed: boolean;
  notes: string | null;
}
