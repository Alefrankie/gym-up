import { z } from 'zod';
import { routineTypeSchema } from './common';

/** A family member as shown in the list. Photos and body data are never part of this view (ADR-005, ADR-023). */
export const memberCardSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  routineType: routineTypeSchema,
  totalWorkouts: z.number().int(),
  currentStreak: z.number().int(),
  /** YYYY-MM-DD, or null when the member has not finished a workout yet. */
  lastWorkout: z.string().nullable(),
});
export type MemberCardDto = z.infer<typeof memberCardSchema>;

export const memberProfileSchema = z.object({
  profile: memberCardSchema,
  workouts: z.array(z.object({ id: z.string(), workoutDate: z.string() })),
  stats: z.object({
    totalWorkouts: z.number().int(),
    currentStreak: z.number().int(),
    lastWorkout: z.string().nullable(),
  }),
});
export type MemberProfileDto = z.infer<typeof memberProfileSchema>;

export const familyResponseSchema = z.array(memberCardSchema);
