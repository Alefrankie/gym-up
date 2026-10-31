import { z } from 'zod';
import { coachRecordingIdSchema, coachRecordingMetaSchema } from './coach';
import { COACH_EVENT_NAMES, COACH_LINE_MAX_CHARS } from './coach-content';

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

/** A line added in the studio (one per address-form variant; `groupId` ties the variants). */
export const studioCustomLineSchema = z.object({
  lineId: coachRecordingIdSchema,
  groupId: z.string(),
  form: z.enum(['m', 'f']).nullable(),
  tone: z.enum(['flower', 'normal', 'gymrat']),
  locale: z.enum(['es', 'en']),
  event: z.enum(COACH_EVENT_NAMES),
  text: z.string(),
  status: z.enum(['approved', 'pending']),
  authorId: z.string(),
  authorName: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type StudioCustomLineDto = z.infer<typeof studioCustomLineSchema>;

/** New text for a built-in line. */
export const studioOverrideSchema = z.object({
  lineId: coachRecordingIdSchema,
  originalText: z.string(),
  text: z.string(),
  updatedAt: z.number().int(),
  updatedByName: z.string(),
});
export type StudioOverrideDto = z.infer<typeof studioOverrideSchema>;

/** Everything the studio screen shows (no audio): takes with votes, comments, added lines and edited texts. */
export const studioOverviewSchema = z.object({
  me: z.object({ userId: z.string(), admin: z.boolean() }),
  takes: z.array(studioTakeSchema),
  comments: z.array(studioCommentSchema),
  custom: z.array(studioCustomLineSchema).default([]),
  overrides: z.array(studioOverrideSchema).default([]),
});
export type StudioOverview = z.infer<typeof studioOverviewSchema>;

export const studioActiveRequestSchema = z.object({ takeId: z.string().min(1) });
export const studioCommentRequestSchema = z.object({ text: z.string().trim().min(1).max(280), takeId: z.string().min(1).nullable().optional() });
export type StudioCommentRequest = z.infer<typeof studioCommentRequestSchema>;

/** Free-tier guards: per person per UTC day, and per take. */
export const STUDIO_DAILY_WRITES = 300;
export const STUDIO_DAILY_BYTES = 30_000_000;
export const STUDIO_USER_TOTAL_BYTES = 200_000_000;

const lineText = z.string().trim().min(1).max(COACH_LINE_MAX_CHARS);

/** Adds a line: the text for "como hombre", and for "como mujer" when the words change (else the same for both). */
export const studioCustomLineRequestSchema = z
  .object({
    tone: z.enum(['flower', 'normal', 'gymrat']),
    locale: z.enum(['es', 'en']),
    event: z.enum(COACH_EVENT_NAMES),
    textM: lineText,
    textF: lineText.nullable().optional(),
  })
  .refine((v) => v.tone !== 'gymrat' || v.locale === 'es', { message: 'gymrat only speaks Spanish', path: ['locale'] });
export type StudioCustomLineRequest = z.infer<typeof studioCustomLineRequestSchema>;

/** New text for a line. For a built-in line, its original rendering and where it belongs. */
export const studioLineTextRequestSchema = z.object({
  text: lineText,
  originalText: z.string().trim().min(1).max(400).optional(),
  tone: z.enum(['flower', 'normal', 'gymrat']).optional(),
  locale: z.enum(['es', 'en']).optional(),
  event: z.enum(COACH_EVENT_NAMES).optional(),
  form: z.enum(['m', 'f']).nullable().optional(),
});
export type StudioLineTextRequest = z.infer<typeof studioLineTextRequestSchema>;

export const studioHistoryEntrySchema = z.object({
  id: z.string(),
  lineId: z.string(),
  kind: z.enum(['create', 'edit', 'revert', 'approve']),
  previousText: z.string().nullable(),
  newText: z.string().nullable(),
  authorName: z.string(),
  createdAt: z.number().int(),
});
export const studioHistorySchema = z.object({ items: z.array(studioHistoryEntrySchema) });
export type StudioHistoryEntryDto = z.infer<typeof studioHistoryEntrySchema>;

/** What the app merges into its catalog: approved added lines and edited texts (cached for offline use). */
export const coachCatalogSchema = z.object({
  custom: z.array(studioCustomLineSchema.pick({ lineId: true, groupId: true, form: true, tone: true, locale: true, event: true, text: true })),
  overrides: z.array(z.object({ lineId: coachRecordingIdSchema, originalText: z.string(), text: z.string() })),
});
export type CoachCatalog = z.infer<typeof coachCatalogSchema>;
