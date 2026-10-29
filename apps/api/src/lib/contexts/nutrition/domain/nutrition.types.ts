// src/lib/contexts/nutrition/domain/nutrition.types.ts
//
// Domain types for the nutrition context (story-5.1 scope).
//
// Only the types required by the AI analyze endpoint are exported here.
// Story-5.3 will add NutritionEntry, NutritionGoal, DailySummary, and
// the create-DTO; they are out of scope for story-5.1.

/**
 * One food item identified by the AI provider.
 * All numeric fields are non-negative integers (kcal / grams).
 */
export interface FoodItem {
  name: string;
  estimated_calories: number;
  estimated_protein: number;
  estimated_carbs: number;
  estimated_fat: number;
}

/**
 * Structured result returned by the AI analyze endpoint.
 * `food_items` must contain at least one item — empty arrays are
 * mapped to `AIUnrecognizedFoodError` by `AnalyzeMealUseCase`.
 */
export interface AIAnalysisResult {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  food_items: FoodItem[];
}

/**
 * Image formats accepted by the analyze endpoint. The endpoint validator
 * enforces these strings; downstream code (adapter, parser) must use the
 * type, not raw literals.
 */
export const PhotoFormats = {
  Jpg: 'jpg',
  Png: 'png',
  Webp: 'webp',
} as const;
export type PhotoFormat = (typeof PhotoFormats)[keyof typeof PhotoFormats];

/**
 * Body of `POST /api/nutrition/analyze`.
 *
 * `imageBase64` may optionally be a data URL
 * (`data:image/<fmt>;base64,<payload>`); the endpoint strips the prefix
 * before validation. Decoded byte length is checked against
 * `PhotoRules.MaxSizeBytes`.
 */
export interface AnalyzeRequestBody {
  format: PhotoFormat;
  imageBase64: string;
}

/**
 * Successful response from `POST /api/nutrition/analyze`.
 *
 * `rawResponse` carries the AI provider's unparsed JSON, useful for
 * debugging and for story-5.7's re-analysis feature; null if the
 * provider response was empty.
 */
export interface AnalyzeSuccessResponse {
  result: AIAnalysisResult;
  rawResponse: Record<string, unknown> | null;
}

/**
 * Error response envelope returned by the endpoint for every failure
 * path. Status code carries the category; `code` carries the stable
 * identifier; `error` carries a human-readable message.
 *
 * User-facing strings are pinned in `analyze-meal.flow.md` and MUST
 * NOT drift without a flow-doc update.
 */
export interface AnalyzeErrorResponse {
  error: string;
  code:
    | 'INVALID_INPUT'
    | 'UNAUTHORIZED'
    | 'AI_UNRECOGNIZED'
    | 'AI_TIMEOUT'
    | 'INTERNAL';
}

export type AnalyzeResponse = AnalyzeSuccessResponse | AnalyzeErrorResponse;

/**
 * MIME type per format — drives the `inline_data.mime_type` field in
 * the Gemini request body. Format-aware mapping avoids the silent
 * format-corruption bug class.
 */
export const ContentTypes: Readonly<Record<PhotoFormat, string>> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

// =============================================================
// Story 5.3 — Nutrition History + Daily Summary types
// =============================================================

/**
 * Persisted nutrition entry. One analyzed meal stored in DB.
 * `foodItems` is stored as JSON text; `aiRawResponse` may be null.
 */
export interface NutritionEntry {
  id: string;
  userId: string;
  storagePath: string;
  photoDate: Date; // integer({ mode: 'timestamp_ms' }) → Date in Drizzle
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  foodItems: string; // JSON-serialized FoodItem[]
  aiRawResponse: string | null; // JSON-serialized provider response
  userEdited: boolean;
  createdAt: Date; // integer({ mode: 'timestamp' }) → Date in Drizzle
}

/**
 * One-to-one with profiles. `dailyCalorieGoal` is null when unset.
 */
export interface NutritionGoal {
  userId: string;
  dailyCalorieGoal: number | null;
  updatedAt: Date; // integer({ mode: 'timestamp' }) → Date in Drizzle
}

/**
 * Input for creating a nutrition entry (SaveNutritionEntryUseCase).
 */
export interface NutritionEntryCreateDTO {
  userId: string;
  storagePath: string;
  photoDate: number; // timestamp_ms
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  foodItems: FoodItem[];
  aiRawResponse: Record<string, unknown> | null;
  userEdited: boolean;
  /** Optional explicit createdAt. Used in tests for deterministic ordering. */
  createdAt?: Date;
}

/**
 * Computed daily calorie summary. Not persisted — derived on read.
 */
export interface DailySummary {
  consumed: number;
  goal: number | null;
  remaining: number | null;
}