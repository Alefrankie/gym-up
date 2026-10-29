import { z } from 'zod';
import { idSchema, isoDateSchema, weightUnitSchema } from './common';

export const workoutStatusSchema = z.enum(['in_progress', 'completed']);
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;

export const workoutSchema = z.object({
  id: idSchema,
  userId: idSchema,
  routineDayId: z.string(),
  workoutDate: isoDateSchema,
  status: workoutStatusSchema,
  startedAt: isoDateSchema,
  completedAt: isoDateSchema.nullable(),
});
export type WorkoutDto = z.infer<typeof workoutSchema>;

/** Start (or continue) a workout. Idempotent by `id` (ADR-025). */
export const startWorkoutRequestSchema = z.object({
  /** Client-generated id; replaying the same command never creates a second workout. */
  id: idSchema,
  routineDayId: z.string().min(1),
  /** When set, the call continues an existing workout instead of creating one. */
  existingWorkoutId: idSchema.optional(),
});
export type StartWorkoutRequest = z.infer<typeof startWorkoutRequestSchema>;

export const workoutEntrySchema = z.object({
  id: idSchema,
  workoutId: idSchema,
  exerciseId: z.string(),
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(1).max(100),
  /** Stored in kg (ADR-006). */
  weight: z.number().min(0).max(500),
  completed: z.boolean(),
  notes: z.string().max(500).nullable(),
  createdAt: isoDateSchema,
});
export type WorkoutEntryDto = z.infer<typeof workoutEntrySchema>;

/** Log or edit one set. Idempotent upsert by `id` (ADR-025). */
export const upsertSetRequestSchema = z.object({
  id: idSchema,
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(100),
  /** Value as typed by the user, in `weightUnit`; the API converts to kg. */
  weight: z.number().min(0),
  weightUnit: weightUnitSchema,
  completed: z.boolean().default(true),
  notes: z.string().max(500).nullable().default(null),
});
export type UpsertSetRequest = z.infer<typeof upsertSetRequestSchema>;

/** One set joined with its exercise, as shown on the workout screen and in history detail. */
export const workoutDetailEntrySchema = z.object({
  id: idSchema,
  exerciseId: z.string(),
  exerciseName: z.string(),
  muscleGroup: z.string(),
  setNumber: z.number().int().min(1),
  reps: z.number().int(),
  /** In kg (ADR-006). */
  weight: z.number(),
  completed: z.boolean(),
  notes: z.string().nullable(),
});
export type WorkoutDetailEntryDto = z.infer<typeof workoutDetailEntrySchema>;

export const workoutDetailSchema = z.object({
  workout: workoutSchema,
  entries: z.array(workoutDetailEntrySchema),
});
export type WorkoutDetailDto = z.infer<typeof workoutDetailSchema>;

export const workoutHistoryItemSchema = z.object({
  id: idSchema,
  workoutDate: isoDateSchema,
  routineDayName: z.string(),
  exerciseCount: z.number().int(),
  /** Sum of reps x weight over completed entries, in kg. */
  totalVolume: z.number(),
  status: workoutStatusSchema,
});
export type WorkoutHistoryItemDto = z.infer<typeof workoutHistoryItemSchema>;

export const workoutHistoryResponseSchema = z.object({
  items: z.array(workoutHistoryItemSchema),
  currentPage: z.number().int(),
  totalPages: z.number().int(),
});
export type WorkoutHistoryResponse = z.infer<typeof workoutHistoryResponseSchema>;

/** Result of starting (or resuming) a workout. */
export const startWorkoutResponseSchema = z.object({
  kind: z.enum(['started', 'resumed']),
  workout: workoutSchema,
});
export type StartWorkoutResponse = z.infer<typeof startWorkoutResponseSchema>;

export const routineExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  exerciseName: z.string(),
  muscleGroup: z.string(),
  targetSets: z.number().int(),
  targetReps: z.number().int(),
  exerciseOrder: z.number().int(),
});
export type RoutineExerciseDto = z.infer<typeof routineExerciseSchema>;

export const dayOptionSchema = z.object({
  dayNumber: z.number().int(),
  dayName: z.string(),
  focus: z.string(),
});

/** What the dashboard shows for today (GET /workouts/today). */
export const todayWorkoutResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('no_routine') }),
  z.object({
    kind: z.literal('rest_day'),
    dayOptions: z.array(dayOptionSchema),
    weightUnit: weightUnitSchema,
  }),
  z.object({
    kind: z.literal('workout_day'),
    routineDay: z.object({ id: z.string(), dayNumber: z.number().int(), dayName: z.string(), focus: z.string() }),
    exercises: z.array(routineExerciseSchema),
    workoutStatus: z.enum(['not_started', 'in_progress', 'completed']),
    existingWorkoutId: z.string().nullable(),
    weightUnit: weightUnitSchema,
    dayNumber: z.number().int(),
  }),
]);
export type TodayWorkoutResponse = z.infer<typeof todayWorkoutResponseSchema>;
