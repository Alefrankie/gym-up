import { z } from 'zod';
import { isoDateSchema } from './common';

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  email: z.string().email(),
  isAdmin: z.boolean(),
  createdAt: isoDateSchema,
  lastAccessAt: isoDateSchema.nullable(),
});
export type AdminUserDto = z.infer<typeof adminUserSchema>;

export const adminUserListSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number().int().nonnegative(),
});
export type AdminUserListDto = z.infer<typeof adminUserListSchema>;

export const adminUserListQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
