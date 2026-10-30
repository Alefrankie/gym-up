import { z } from 'zod';
import { coachRecordingIdSchema, coachRecordingMetaSchema } from './coach';

/** Voice studio for several people: the admin lets people in, everyone records takes, the admin picks the one played. */

export const studioAccessSchema = z.object({ allowed: z.boolean(), admin: z.boolean() });
export type StudioAccess = z.infer<typeof studioAccessSchema>;

export const studioMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  email: z.string(),
  grantedAt: z.number().int(),
});
export type StudioMemberDto = z.infer<typeof studioMemberSchema>;
export const studioMemberListSchema = z.object({ items: z.array(studioMemberSchema) });

/** Admin search over users, to grant access. */
export const studioUserSchema = z.object({ userId: z.string(), displayName: z.string(), email: z.string(), member: z.boolean() });
export type StudioUserDto = z.infer<typeof studioUserSchema>;
export const studioUserListSchema = z.object({ items: z.array(studioUserSchema) });

export const studioTakeSchema = coachRecordingMetaSchema.extend({
  id: z.string(),
  lineId: coachRecordingIdSchema,
  authorId: z.string(),
  authorName: z.string(),
  contentType: z.string(),
  bytes: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  votes: z.number().int(),
  votedByMe: z.boolean(),
  active: z.boolean(),
});
export type StudioTakeDto = z.infer<typeof studioTakeSchema>;

export const studioCommentSchema = z.object({
  id: z.string(),
  lineId: coachRecordingIdSchema,
  takeId: z.string().nullable(),
  authorId: z.string(),
  authorName: z.string(),
  text: z.string(),
  createdAt: z.number().int(),
});
export type StudioCommentDto = z.infer<typeof studioCommentSchema>;

/** Everything the studio screen shows (no audio): every take with its votes, and every comment. */
export const studioOverviewSchema = z.object({
  me: z.object({ userId: z.string(), admin: z.boolean() }),
  takes: z.array(studioTakeSchema),
  comments: z.array(studioCommentSchema),
});
export type StudioOverview = z.infer<typeof studioOverviewSchema>;

export const studioActiveRequestSchema = z.object({ takeId: z.string().min(1) });
export const studioCommentRequestSchema = z.object({ text: z.string().trim().min(1).max(280), takeId: z.string().min(1).nullable().optional() });
export type StudioCommentRequest = z.infer<typeof studioCommentRequestSchema>;

/** Free-tier guards: per person per UTC day, and per take. */
export const STUDIO_DAILY_WRITES = 300;
export const STUDIO_DAILY_BYTES = 30_000_000;
export const STUDIO_USER_TOTAL_BYTES = 200_000_000;
