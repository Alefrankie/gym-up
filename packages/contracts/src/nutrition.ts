import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';

export const mealMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);
export type MealMimeType = z.infer<typeof mealMimeTypeSchema>;

export const foodItemSchema = z.object({
  name: z.string().min(1).max(120),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
});
export type FoodItemDto = z.infer<typeof foodItemSchema>;

/** Estimated nutrition of a meal. Calories in kcal, macros in grams. */
export const mealAnalysisSchema = z.object({
  totalCalories: z.number().min(0),
  totalProtein: z.number().min(0),
  totalCarbs: z.number().min(0),
  totalFat: z.number().min(0),
  foodItems: z.array(foodItemSchema),
});
export type MealAnalysisDto = z.infer<typeof mealAnalysisSchema>;

/** The app compresses the photo on the device first; the API refuses anything over the photo size limit. */
export const analyzeMealRequestSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: mealMimeTypeSchema,
});
export type AnalyzeMealRequest = z.infer<typeof analyzeMealRequestSchema>;

export const analyzeMealResponseSchema = mealAnalysisSchema;
export type AnalyzeMealResponse = z.infer<typeof analyzeMealResponseSchema>;

/** Saves a meal, optionally with its photo. Idempotent by the client-generated `id` (ADR-025). */
export const logMealRequestSchema = mealAnalysisSchema.extend({
  id: idSchema,
  imageBase64: z.string().min(1).optional(),
  mimeType: mealMimeTypeSchema.optional(),
  /** True when the user changed the AI estimate before saving. */
  userEdited: z.boolean().default(false),
});
export type LogMealRequest = z.infer<typeof logMealRequestSchema>;

export const nutritionEntrySchema = mealAnalysisSchema.extend({
  id: idSchema,
  loggedAt: isoDateSchema,
  userEdited: z.boolean(),
  hasPhoto: z.boolean(),
});
export type NutritionEntryDto = z.infer<typeof nutritionEntrySchema>;

export const nutritionHistoryResponseSchema = z.array(nutritionEntrySchema);

export const dailySummarySchema = z.object({
  consumed: z.number(),
  goal: z.number().nullable(),
  remaining: z.number().nullable(),
});
export type DailySummaryDto = z.infer<typeof dailySummarySchema>;

export const calorieGoalSchema = z.object({
  /** kcal per day, or null to clear the goal. */
  dailyCalorieGoal: z.number().int().min(1).max(10_000).nullable(),
});
export type CalorieGoalDto = z.infer<typeof calorieGoalSchema>;
