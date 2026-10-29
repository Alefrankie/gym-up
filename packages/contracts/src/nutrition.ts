import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';

export const macrosSchema = z.object({
  calories: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
});
export type Macros = z.infer<typeof macrosSchema>;

export const analyzeMealRequestSchema = z.object({
  /** Base64 image data, already compressed on the client. */
  imageBase64: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
export type AnalyzeMealRequest = z.infer<typeof analyzeMealRequestSchema>;

export const analyzeMealResponseSchema = z.object({
  description: z.string(),
  macros: macrosSchema,
});
export type AnalyzeMealResponse = z.infer<typeof analyzeMealResponseSchema>;

export const nutritionEntrySchema = z.object({
  id: idSchema,
  description: z.string(),
  macros: macrosSchema,
  loggedAt: isoDateSchema,
});
export type NutritionEntryDto = z.infer<typeof nutritionEntrySchema>;

export const saveNutritionEntryRequestSchema = nutritionEntrySchema.omit({ loggedAt: true });
export type SaveNutritionEntryRequest = z.infer<typeof saveNutritionEntryRequestSchema>;

export const calorieGoalSchema = z.object({ dailyCalories: z.number().int().min(500).max(10000) });
export type CalorieGoal = z.infer<typeof calorieGoalSchema>;
