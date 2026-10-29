import { z } from 'zod';
import { idSchema } from './common';
import { memberCardSchema } from './family';

export const groupSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Invite code; any member can share it. */
  code: z.string(),
  memberCount: z.number().int(),
  isOwner: z.boolean(),
});
export type GroupSummaryDto = z.infer<typeof groupSummarySchema>;

export const groupListResponseSchema = z.object({ items: z.array(groupSummarySchema) });
export type GroupListResponse = z.infer<typeof groupListResponseSchema>;

export const groupDetailSchema = z.object({
  group: groupSummarySchema,
  members: z.array(memberCardSchema),
});
export type GroupDetailDto = z.infer<typeof groupDetailSchema>;

export const GROUP_CODE_LENGTH = 6;

/** POST /groups: idempotent by the client `id`. */
export const createGroupRequestSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(2).max(40),
});
export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;

/** POST /groups/join */
export const joinGroupRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(GROUP_CODE_LENGTH),
});
export type JoinGroupRequest = z.infer<typeof joinGroupRequestSchema>;
