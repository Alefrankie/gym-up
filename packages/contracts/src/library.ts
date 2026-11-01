import { z } from 'zod';
import { idSchema } from './common';

/** Muscle taxonomy (ADR-017, Hevy list). */
export const MUSCLE_GROUPS = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'cardio',
  'chest',
  'forearms',
  'full_body',
  'glutes',
  'hamstrings',
  'lats',
  'lower_back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
  'upper_back',
  'other',
] as const;
export const muscleGroupSchema = z.enum(MUSCLE_GROUPS);
export type MuscleGroup = z.infer<typeof muscleGroupSchema>;

/** `pull_up_bar` is its own category: hanging work needs a bar, unlike floor and parallel-bar bodyweight work. */
export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'pull_up_bar', 'kettlebell', 'band', 'other'] as const;
export const equipmentSchema = z.enum(EQUIPMENT);
export type Equipment = z.infer<typeof equipmentSchema>;

export const EXERCISE_TYPES = ['weight_reps', 'bodyweight_reps', 'duration', 'distance_duration'] as const;
export const exerciseTypeSchema = z.enum(EXERCISE_TYPES);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

/**
 * Training-style collections an exercise belongs to, independent of the equipment it needs: a pull-up is
 * calisthenics and still requires a bar. A list, so more collections can join `calisthenics` later.
 */
export const EXERCISE_STYLES = ['calisthenics'] as const;
export const exerciseStyleSchema = z.enum(EXERCISE_STYLES);
export type ExerciseStyle = z.infer<typeof exerciseStyleSchema>;

export const libraryExerciseDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  primaryMuscle: z.string(),
  secondaryMuscles: z.array(z.string()),
  equipment: z.string(),
  exerciseType: z.string(),
  /** Style collections this exercise belongs to; absent in payloads cached before collections existed. */
  styles: z.array(z.string()).default([]),
  instructions: z.string().nullable(),
  videoUrl: z.string().nullable(),
  /** `true` for exercises created by a user (editable by the owner only). */
  isCustom: z.boolean(),
  ownerId: z.string().nullable(),
  isArchived: z.boolean(),
});
export type LibraryExerciseDto = z.infer<typeof libraryExerciseDtoSchema>;

export const libraryExerciseListResponseSchema = z.object({ items: z.array(libraryExerciseDtoSchema) });
export type LibraryExerciseListResponse = z.infer<typeof libraryExerciseListResponseSchema>;

const exerciseFields = {
  name: z.string().trim().min(2).max(60),
  primaryMuscle: muscleGroupSchema,
  secondaryMuscles: z.array(muscleGroupSchema).max(5).default([]),
  equipment: equipmentSchema,
  exerciseType: exerciseTypeSchema.default('weight_reps'),
  /** Opt-in: a custom exercise joins a collection only when its owner says so. */
  styles: z.array(exerciseStyleSchema).max(EXERCISE_STYLES.length).default([]),
  instructions: z.string().trim().max(2000).nullish(),
  videoUrl: z.string().trim().url().max(300).nullish(),
};

/** POST /exercises: custom exercise. Idempotent by the client `id` (ADR-025). */
export const createExerciseRequestSchema = z.object({ id: idSchema.optional(), ...exerciseFields });
export type CreateExerciseRequest = z.infer<typeof createExerciseRequestSchema>;

/** PATCH /exercises/:id: owner only; at least one field. */
export const updateExerciseRequestSchema = z
  .object(exerciseFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateExerciseRequest = z.infer<typeof updateExerciseRequestSchema>;
