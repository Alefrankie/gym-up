// src/lib/contexts/recipes/domain/recipes.repository.ts
//
// Recipes (DR-0029): shared, member-only recipe content with likes and ratings.
//
// The list model is a deliberate projection: a card needs a cover, times, tags, macros and the two
// counters, never the ingredients. Ingredients, substitutes, steps and photo rows are only loaded for one
// recipe at a time, when the detail screen asks for it.

export interface RecipeCursor {
  createdAtMs: number;
  id: string;
}

export interface RecipeMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeSubstitute {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
}

export interface RecipeIngredient {
  id: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  optional: boolean;
  substitutes: RecipeSubstitute[];
}

export interface RecipeStep {
  /** 1-based. Also the key a step photo uses. */
  order: number;
  text: string;
  minutes: number | null;
  /** Resolved from `recipe_photos` by step order; null when the step has no photo. */
  photoId: string | null;
}

export interface RecipeSummaryRecord {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  /** null = draft with no cover yet. Only its author can see it. */
  coverPhotoId: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number;
  tags: string[];
  macros: RecipeMacros | null;
  likeCount: number;
  viewerHasLiked: boolean;
  ratingCount: number;
  /** null when nobody has rated it. Never 0. */
  ratingAverage: number | null;
  viewerRating: number | null;
  createdAt: Date;
}

export interface RecipeDetailRecord extends RecipeSummaryRecord {
  description: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  updatedAt: Date;
}

/** Everything a create or edit writes. `id` and `authorId` are set by the use case, not by the client. */
export interface RecipeDraftRecord {
  id: string;
  authorId: string;
  title: string;
  description: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number;
  tags: string[];
  macros: RecipeMacros | null;
  ingredients: RecipeIngredient[];
  steps: Array<Omit<RecipeStep, 'photoId'>>;
}

/** What `create` did: a first write, a replay by the same author, or an id owned by someone else. */
export type RecipeCreateOutcome = 'created' | 'replayed' | 'taken';

export interface RecipePhotoRecord {
  id: string;
  recipeId: string;
  /** null = cover. */
  stepOrder: number | null;
  storageKey: string;
  contentType: string;
}

export interface RecipeListFilters {
  viewerId: string;
  cursor: RecipeCursor | null;
  limit: number;
  /** Matches the title and the ingredient names. */
  q?: string;
  tag?: string;
  /** Ceiling on prep + cook. Recipes with neither time are excluded. */
  maxMinutes?: number;
  /** Matches one ingredient by name. */
  ingredient?: string;
  authorId?: string;
}

export abstract class RecipeRepository {
  /**
   * Newest first (created_at, then id). Includes every published recipe plus the viewer's own drafts.
   */
  abstract list(filters: RecipeListFilters): Promise<RecipeSummaryRecord[]>;

  /** A published recipe, or one of the viewer's own drafts. Undefined otherwise. */
  abstract findDetail(viewerId: string, recipeId: string): Promise<RecipeDetailRecord | undefined>;

  /** The list projection of one recipe, with the same visibility rule. Undefined when the viewer cannot see it. */
  abstract findSummary(viewerId: string, recipeId: string): Promise<RecipeSummaryRecord | undefined>;

  /** Author of any recipe, drafts included. Used for ownership checks before the detail projection. */
  abstract findAuthorId(recipeId: string): Promise<string | undefined>;

  /**
   * Inserts the recipe and its children. The id is the guard, not a prior read: a replay by the same author
   * rewrites the children (repairing an attempt that failed halfway) and an id owned by someone else writes
   * nothing, which is how a replayed create stays harmless (ADR-025).
   */
  abstract create(input: RecipeDraftRecord, at: number): Promise<RecipeCreateOutcome>;

  /** Replaces the draft's text, ingredients and steps. Photos are handled separately. */
  abstract update(recipeId: string, input: Omit<RecipeDraftRecord, 'id' | 'authorId'>, at: number): Promise<void>;

  /** Idempotent. */
  abstract like(recipeId: string, userId: string, at: number): Promise<void>;
  /** Idempotent. */
  abstract unlike(recipeId: string, userId: string): Promise<void>;
  abstract likeState(
    recipeId: string,
    viewerId: string,
  ): Promise<{ likeCount: number; viewerHasLiked: boolean }>;

  /** One per member; rating again replaces the previous value. */
  abstract rate(recipeId: string, userId: string, rating: number, at: number): Promise<void>;
  abstract ratingState(
    recipeId: string,
    viewerId: string,
  ): Promise<{ ratingCount: number; ratingAverage: number | null; viewerRating: number | null }>;

  abstract findPhoto(recipeId: string, photoId: string): Promise<RecipePhotoRecord | undefined>;
  abstract findPhotoByStep(recipeId: string, stepOrder: number | null): Promise<RecipePhotoRecord | undefined>;
  /** Replaces whatever occupied that slot (cover or step). */
  abstract savePhoto(record: RecipePhotoRecord & { bytes: number; createdAt: number }): Promise<void>;
  abstract deletePhoto(recipeId: string, photoId: string): Promise<void>;
  /**
   * Drops step photos whose step no longer exists and returns their storage keys so the caller can delete
   * the objects. Photos are keyed by step position, so a shorter recipe cannot keep stale ones.
   */
  abstract pruneStepPhotos(recipeId: string, stepCount: number): Promise<string[]>;
}
