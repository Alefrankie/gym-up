import { z } from 'zod';

/**
 * Community (DR-0028): every signed-in member sees every other member's completed workouts, active routine,
 * active supplement names and weekly training totals. These are deliberately narrow projections: body
 * weight, body-weight snapshots, set notes, nutrition, supplement intake logs and private photos never appear.
 */

export const communityAuthorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
});
export type CommunityAuthorDto = z.infer<typeof communityAuthorSchema>;

/** One exercise inside a shared workout: completed working sets only. */
export const communityExerciseSchema = z.object({
  exerciseId: z.string(),
  /** Canonical name; the client translates system exercises. */
  name: z.string(),
  sets: z.number().int(),
  reps: z.number().int(),
  /** Heaviest external load of the completed sets, kg. 0 for bodyweight-only work. */
  topWeightKg: z.number(),
});
export type CommunityExerciseDto = z.infer<typeof communityExerciseSchema>;

export const communityWorkoutSchema = z.object({
  id: z.string(),
  author: communityAuthorSchema,
  /** YYYY-MM-DD: the calendar day the workout was logged for. */
  workoutDate: z.string(),
  dayName: z.string(),
  routineName: z.string().nullable(),
  /** Minutes between start and completion, when both are known and plausible. */
  durationMinutes: z.number().int().nullable(),
  exercises: z.array(communityExerciseSchema),
  totalSets: z.number().int(),
  /** Sum of completed reps × external kg (warm-ups excluded). Never includes body weight. */
  volumeKg: z.number(),
  hasPhoto: z.boolean(),
  likeCount: z.number().int(),
  viewerHasLiked: z.boolean(),
  /** True for the viewer's own workout: it can carry a photo but cannot be liked by its author. */
  isMine: z.boolean(),
});
export type CommunityWorkoutDto = z.infer<typeof communityWorkoutSchema>;

export const communityPageSchema = z.object({
  items: z.array(communityWorkoutSchema),
  nextCursor: z.string().nullable(),
});
export type CommunityPageDto = z.infer<typeof communityPageSchema>;

export const communityMemberSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  totalWorkouts: z.number().int(),
  /** YYYY-MM-DD or null. */
  lastWorkout: z.string().nullable(),
});
export type CommunityMemberDto = z.infer<typeof communityMemberSchema>;

export const communityMemberListSchema = z.object({ items: z.array(communityMemberSchema) });
export type CommunityMemberListDto = z.infer<typeof communityMemberListSchema>;

export const weekTotalsSchema = z.object({
  /** Monday, YYYY-MM-DD. */
  start: z.string(),
  /** Sunday, YYYY-MM-DD. */
  end: z.string(),
  sessions: z.number().int(),
  sets: z.number().int(),
  volumeKg: z.number(),
});
export type WeekTotalsDto = z.infer<typeof weekTotalsSchema>;

export const memberRoutineSchema = z.object({
  name: z.string(),
  days: z.array(
    z.object({
      dayName: z.string(),
      focus: z.string(),
      exercises: z.array(
        z.object({
          name: z.string(),
          sets: z.number().int(),
          repsMin: z.number().int(),
          repsMax: z.number().int(),
        }),
      ),
    }),
  ),
});
export type MemberRoutineDto = z.infer<typeof memberRoutineSchema>;

export const communityProfileSchema = z.object({
  member: communityMemberSchema,
  isMe: z.boolean(),
  thisWeek: weekTotalsSchema,
  lastWeek: weekTotalsSchema,
  routine: memberRoutineSchema.nullable(),
  /** Names of active supplements only; intake history stays private. */
  supplements: z.array(z.string()),
});
export type CommunityProfileDto = z.infer<typeof communityProfileSchema>;

export const likeStateSchema = z.object({
  likeCount: z.number().int(),
  viewerHasLiked: z.boolean(),
});
export type LikeStateDto = z.infer<typeof likeStateSchema>;

export const communityCursorQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
});
