import { z } from 'zod';

export const feedbackCategorySchema = z.enum(['idea', 'bug', 'other']);
export const feedbackStatusSchema = z.enum(['open', 'planned', 'in_progress', 'resolved']);
export const feedbackItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  category: feedbackCategorySchema,
  status: feedbackStatusSchema,
  authorName: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export const feedbackListSchema = z.object({ items: z.array(feedbackItemSchema), canManage: z.boolean().default(false) });
export const createFeedbackRequestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).default(''),
  category: feedbackCategorySchema.default('idea'),
});
export const updateFeedbackStatusRequestSchema = z.object({ status: feedbackStatusSchema });
export type FeedbackItemDto = z.infer<typeof feedbackItemSchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;
export type CreateFeedbackRequest = z.infer<typeof createFeedbackRequestSchema>;
