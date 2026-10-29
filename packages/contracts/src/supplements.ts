import { z } from 'zod';
import { idSchema } from './common';

/** A calendar day as the user sees it (their local date). */
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const supplementDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Taken on the requested day. */
  taken: z.boolean(),
  /** Days taken in the window, oldest first (`YYYY-MM-DD`). */
  days: z.array(daySchema),
  /** Consecutive days taken, ending on the requested day (or the day before when not taken yet). */
  streak: z.number().int(),
});
export type SupplementDto = z.infer<typeof supplementDtoSchema>;

export const supplementListResponseSchema = z.object({
  day: daySchema,
  items: z.array(supplementDtoSchema),
});
export type SupplementListResponse = z.infer<typeof supplementListResponseSchema>;

export const addSupplementRequestSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(40),
});
export type AddSupplementRequest = z.infer<typeof addSupplementRequestSchema>;

export const markSupplementRequestSchema = z.object({
  day: daySchema,
  taken: z.boolean(),
});
export type MarkSupplementRequest = z.infer<typeof markSupplementRequestSchema>;
