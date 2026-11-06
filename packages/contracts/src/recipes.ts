import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';
import { photoContentTypeSchema } from './photos';
import { communityAuthorSchema, likeStateSchema } from './community';
import { nutritionEntrySchema } from './nutrition';

/**
 * Recipes (DR-0029). A recipe is shared content: every signed-in member can read every recipe, like it and
 * rate it. Comments are deliberately absent.
 *
 * Ingredients, substitutes and steps are structured, not free text: quantities stay numeric so servings can
 * be scaled, and a substitute is attached to the ingredient it replaces instead of living in a paragraph.
 * Macros are per serving and may be null when nobody estimated them — never invented.
 */

/** Filter tags. "Quick" is not a tag: it is `maxMinutes` on the query. */
export const recipeTagSchema = z.enum([
  'alto-proteina',
  'sin-horno',
  'air-fryer',
  'vegetariana',
  'vegana',
  'sin-lactosa',
  'meal-prep',
  'desayuno',
  'snack',
]);
export type RecipeTag = z.infer<typeof recipeTagSchema>;

/** An alternative for one ingredient ("¿no tienes quinoa? → arroz integral"). */
export const recipeSubstituteSchema = z.object({
  /** Client-generated so the editor can target one row (ADR-025). */
  id: idSchema,
  name: z.string().min(1).max(120),
  /** Amount of the substitute, in the same unit as the ingredient it replaces. Null keeps the ingredient's. */
  quantity: z.number().min(0).max(10_000).nullable(),
  unit: z.string().max(24).nullable(),
  /** Free note such as "cambia poco: ±20 kcal". Never used to recompute macros. */
  note: z.string().max(200).nullable(),
});
export type RecipeSubstituteDto = z.infer<typeof recipeSubstituteSchema>;

export const recipeIngredientSchema = z.object({
  id: idSchema,
  /** Numeric so the client can scale by servings. Null when the amount is "al gusto". */
  quantity: z.number().min(0).max(10_000).nullable(),
  unit: z.string().max(24).nullable(),
  name: z.string().min(1).max(160),
  /** Optional ingredients are shown greyed out and never counted by default. */
  optional: z.boolean().default(false),
  substitutes: z.array(recipeSubstituteSchema).max(6).default([]),
});
export type RecipeIngredientDto = z.infer<typeof recipeIngredientSchema>;

export const recipeStepDraftSchema = z.object({
  /** 1-based position. The API re-derives it from the array order, so a gap or a duplicate cannot break
   * the key a step photo is stored under. */
  order: z.number().int().min(1).max(50),
  text: z.string().min(1).max(1_200),
  /** Time this step takes on its own, when the author wants to give it. */
  minutes: z.number().int().min(0).max(600).nullable(),
});
export type RecipeStepDraft = z.infer<typeof recipeStepDraftSchema>;

/** A step as the detail screen reads it: the draft plus the photo uploaded for that step. */
export const recipeStepSchema = recipeStepDraftSchema.extend({
  /** Photo of this step. Steps without a photo are the normal case. */
  photoId: idSchema.nullable(),
});
export type RecipeStepDto = z.infer<typeof recipeStepSchema>;

/** Estimated nutrition of ONE serving. Calories in kcal, macros in grams. */
export const recipeMacrosSchema = z.object({
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
});
export type RecipeMacrosDto = z.infer<typeof recipeMacrosSchema>;

/** What the author writes. Ids on ingredients, substitutes and photos are client-generated. */
export const recipeDraftSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  /** Minutes of hands-on work before cooking. Null when the author does not want to say. */
  prepMinutes: z.number().int().min(0).max(600).nullable(),
  /** Minutes on the heat. Null when unknown. */
  cookMinutes: z.number().int().min(0).max(600).nullable(),
  servings: z.number().int().min(1).max(20).default(2),
  ingredients: z.array(recipeIngredientSchema).min(1).max(60),
  steps: z.array(recipeStepDraftSchema).min(1).max(50),
  tags: z.array(recipeTagSchema).max(6).default([]),
  /** Per serving. Null = nobody estimated them. Substituting an ingredient does not recompute this. */
  macros: recipeMacrosSchema.nullable(),
});
export type RecipeDraft = z.infer<typeof recipeDraftSchema>;

export const createRecipeRequestSchema = recipeDraftSchema.extend({ id: idSchema });
export type CreateRecipeRequest = z.infer<typeof createRecipeRequestSchema>;

/** Replaces the whole draft. Partial edits are not a thing: the editor always sends what it shows. */
export const updateRecipeRequestSchema = recipeDraftSchema;
export type UpdateRecipeRequest = z.infer<typeof updateRecipeRequestSchema>;

/** Who wrote it. Same shape the Community feed uses for workout authors (DR-0028). */
export const recipeAuthorSchema = communityAuthorSchema;
export type RecipeAuthorDto = z.infer<typeof recipeAuthorSchema>;

/**
 * List projection. Deliberately narrow: the list never needs ingredients, steps or substitutes.
 */
export const recipeSummarySchema = z.object({
  id: idSchema,
  author: recipeAuthorSchema,
  title: z.string(),
  coverPhotoId: idSchema.nullable(),
  /** prep + cook when at least one is known. Used by the "≤ 15 min" filter, so the server computes it. */
  totalMinutes: z.number().int().nullable(),
  servings: z.number().int(),
  tags: z.array(recipeTagSchema),
  macros: recipeMacrosSchema.nullable(),
  likeCount: z.number().int(),
  viewerHasLiked: z.boolean(),
  ratingCount: z.number().int(),
  /** Null when nobody has rated it. Never 0, which would read as "rated zero stars". */
  ratingAverage: z.number().min(0).max(5).nullable(),
  viewerRating: z.number().int().min(1).max(5).nullable(),
  /** Authors cannot like or rate their own recipe; the UI hides both controls. */
  isMine: z.boolean(),
  createdAt: isoDateSchema,
});
export type RecipeSummaryDto = z.infer<typeof recipeSummarySchema>;

export const recipeDetailSchema = recipeSummarySchema.extend({
  description: z.string().nullable(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(recipeStepSchema),
  updatedAt: isoDateSchema,
});
export type RecipeDetailDto = z.infer<typeof recipeDetailSchema>;

export const recipePageSchema = z.object({
  items: z.array(recipeSummarySchema),
  nextCursor: z.string().nullable(),
});
export type RecipePageDto = z.infer<typeof recipePageSchema>;

export const RECIPE_PAGE_SIZE = 20;

/** Listing filters. `q` matches the title and the ingredient names. */
export const recipeQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  q: z.string().max(80).optional(),
  tag: recipeTagSchema.optional(),
  /** Total time ceiling in minutes; the "≤ 15 min" chip. */
  maxMinutes: z.coerce.number().int().min(1).max(600).optional(),
  /** Match one ingredient by name ("pollo"). */
  ingredient: z.string().max(60).optional(),
  authorId: z.string().max(64).optional(),
});
export type RecipeQuery = z.infer<typeof recipeQuerySchema>;

/** Likes reuse the Community contract: idempotent PUT/DELETE, count plus `viewerHasLiked`, no voter list. */
export const recipeLikeStateSchema = likeStateSchema;
export type RecipeLikeStateDto = z.infer<typeof recipeLikeStateSchema>;

export const rateRecipeRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
});
export type RateRecipeRequest = z.infer<typeof rateRecipeRequestSchema>;

export const recipeRatingStatesSchema = z.object({
  ratingCount: z.number().int(),
  ratingAverage: z.number().min(0).max(5).nullable(),
  viewerRating: z.number().int().min(1).max(5).nullable(),
});
export type RecipeRatingStatesDto = z.infer<typeof recipeRatingStatesSchema>;

/**
 * One photo of a recipe: the cover (`stepOrder` null) or a step photo. The bytes come from
 * `GET /recipes/:id/photos/:photoId/file`; like shared workout photos, every signed-in member may read them.
 */
export const recipePhotoSchema = z.object({
  id: idSchema,
  recipeId: idSchema,
  stepOrder: z.number().int().nullable(),
  contentType: photoContentTypeSchema,
});
export type RecipePhotoDto = z.infer<typeof recipePhotoSchema>;

/** The app compresses on the device first; the API refuses anything over the photo size limit. */
export const uploadRecipePhotoRequestSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: photoContentTypeSchema,
  /** null uploads the cover. */
  stepOrder: z.number().int().min(1).max(50).nullable(),
});
export type UploadRecipePhotoRequest = z.infer<typeof uploadRecipePhotoRequestSchema>;

/**
 * "Añadir a hoy": log the recipe as a meal, scaling its per-serving macros by the servings eaten.
 * Returns the same entry the photo-based meal log returns, so the daily summary needs no special case.
 */
export const logRecipeRequestSchema = z.object({
  id: idSchema,
  /** Servings actually eaten. 0.5 = half a serving. */
  servings: z.number().min(0.25).max(20),
});
export type LogRecipeRequest = z.infer<typeof logRecipeRequestSchema>;

export const logRecipeResponseSchema = nutritionEntrySchema;
export type LogRecipeResponse = z.infer<typeof logRecipeResponseSchema>;
