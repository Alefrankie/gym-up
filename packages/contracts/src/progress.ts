import { z } from 'zod';

export const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscleGroup: z.string(),
});
export type ExerciseDto = z.infer<typeof exerciseSchema>;

export const dateRangeSchema = z.enum(['7d', '30d', 'all']);
export type DateRange = z.infer<typeof dateRangeSchema>;

/** One day of an exercise's history. Both values are in kg. */
export const chartPointSchema = z.object({
  /** YYYY-MM-DD (UTC calendar day). */
  date: z.string(),
  /** Heaviest set of the day. */
  weight: z.number(),
  /** Sum of reps x weight over the day. */
  volume: z.number(),
});
export type ChartPointDto = z.infer<typeof chartPointSchema>;

export const streakSchema = z.object({
  /** Consecutive days with a workout, ending today (or yesterday if none today). */
  current: z.number().int(),
  /** All-time completed workouts. */
  total: z.number().int(),
});
export type StreakDto = z.infer<typeof streakSchema>;

export const calendarDaySchema = z.object({
  date: z.string(),
  hasWorkout: z.boolean(),
});
export type CalendarDayDto = z.infer<typeof calendarDaySchema>;

export const exerciseListResponseSchema = z.array(exerciseSchema);
export const exerciseHistoryResponseSchema = z.array(chartPointSchema);
export const calendarResponseSchema = z.array(calendarDaySchema);
