import { z } from 'zod';
import { idSchema, setPlanSchema } from './common';

/** Limits from ADR-018. */
export const PROGRAM_LIMITS = { programs: 20, routines: 14, exercises: 30, maxSets: 20, maxReps: 100 } as const;

export const programExerciseDtoSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  exerciseName: z.string(),
  muscleGroup: z.string(),
  secondaryMuscles: z.array(z.string()).optional(),
  /** barbell, dumbbell, machine… (the same movement is a different exercise per equipment). */
  equipment: z.string().optional(),
  targetSets: z.number().int(),
  targetReps: z.number().int(),
  warmupSets: z.number().int(),
  restSeconds: z.number().int().nullable(),
  notes: z.string().nullable(),
  /** Reps and kind of each set; absent means `targetSets` normal sets of `targetReps`. */
  sets: setPlanSchema.nullable().optional(),
});
export type ProgramExerciseDto = z.infer<typeof programExerciseDtoSchema>;

export const programRoutineDtoSchema = z.object({
  id: z.string(),
  /** Position in the rotation, 1-based. */
  dayNumber: z.number().int(),
  name: z.string(),
  focus: z.string(),
  notes: z.string().nullable(),
  /** Planned day of the week, 0 = Sunday … 6 = Saturday; null = no fixed day. */
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  exercises: z.array(programExerciseDtoSchema),
});
export type ProgramRoutineDto = z.infer<typeof programRoutineDtoSchema>;

export const programSummaryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  level: z.string().nullable(),
  goal: z.string().nullable(),
  daysPerWeek: z.number().int().nullable(),
  isTemplate: z.boolean(),
  routineCount: z.number().int(),
  sourceTemplateId: z.string().nullable(),
  /** Exercises and planned sets in one full rotation; most-trained muscle groups first (list only). */
  exerciseCount: z.number().int().optional(),
  setCount: z.number().int().optional(),
  muscles: z.array(z.string()).optional(),
});
export type ProgramSummaryDto = z.infer<typeof programSummaryDtoSchema>;

export const programDetailDtoSchema = programSummaryDtoSchema.extend({
  routines: z.array(programRoutineDtoSchema),
});
export type ProgramDetailDto = z.infer<typeof programDetailDtoSchema>;

export const programListResponseSchema = z.object({
  templates: z.array(programSummaryDtoSchema),
  mine: z.array(programSummaryDtoSchema),
  activeProgramId: z.string().nullable(),
});
export type ProgramListResponse = z.infer<typeof programListResponseSchema>;

const repsSchema = z.number().int().min(1).max(PROGRAM_LIMITS.maxReps);

export const programExerciseInputSchema = z.object({
    id: idSchema.optional(),
    exerciseId: z.string().min(1),
    targetSets: z.number().int().min(1).max(PROGRAM_LIMITS.maxSets),
    targetReps: repsSchema,
    warmupSets: z.number().int().min(0).max(PROGRAM_LIMITS.maxSets).default(0),
    restSeconds: z.number().int().min(0).max(600).nullish(),
    notes: z.string().trim().max(500).nullish(),
    sets: setPlanSchema.nullish(),
});
export type ProgramExerciseInput = z.infer<typeof programExerciseInputSchema>;

export const programRoutineInputSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(60),
  focus: z.string().trim().max(80).default(''),
  notes: z.string().trim().max(500).nullish(),
  weekday: z.number().int().min(0).max(6).nullish(),
  exercises: z.array(programExerciseInputSchema).max(PROGRAM_LIMITS.exercises),
});
export type ProgramRoutineInput = z.infer<typeof programRoutineInputSchema>;

/** POST /programs: an empty program, idempotent by the client `id`. */
export const createProgramRequestSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).nullish(),
});
export type CreateProgramRequest = z.infer<typeof createProgramRequestSchema>;

/** PUT /programs/:id: replaces the whole structure. Routines and exercises missing from the body are removed. */
export const saveProgramRequestSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).nullish(),
  routines: z.array(programRoutineInputSchema).max(PROGRAM_LIMITS.routines),
});
export type SaveProgramRequest = z.infer<typeof saveProgramRequestSchema>;
