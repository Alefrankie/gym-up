// src/lib/contexts/recipes/application/recipes.use-cases.ts
//
// Recipes (DR-0029): member-only shared recipes. Every signed-in member reads, likes and rates every
// published recipe; an author cannot like or rate their own, and there are no comments.
//
// A recipe without a cover photo is a draft: visible to its author, to nobody else, and never in someone
// else's list. Photo failures never take the recipe's text with them.
//
// Photo byte validation and the "storage not configured" error live in `community`; both are generic and
// belong to `private-photos`, and are imported rather than duplicated so one rule cannot drift from another.

import {
  RECIPE_PAGE_SIZE,
  type CreateRecipeRequest,
  type LikeStateDto,
  type LogRecipeRequest,
  type LogRecipeResponse,
  type PhotoContentType,
  type RecipeDetailDto,
  type RecipePageDto,
  type RecipePhotoDto,
  type RecipeQuery,
  type RecipeRatingStatesDto,
  type RecipeSummaryDto,
  type RecipeTag,
  type UpdateRecipeRequest,
} from '@gym-up/contracts';
import type { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import { PhotoStorageUnavailableError, sniffImage } from '@/lib/contexts/community/application/community.use-cases';
import type { RecipeCursor, RecipeDetailRecord, RecipeDraftRecord, RecipeRepository, RecipeStep, RecipeSummaryRecord } from '../domain/recipes.repository';
import type { MealLogPort } from '../domain/ports/meal-log.port';

export class RecipeNotFoundError extends Error {
  constructor() {
    super('Recipe not found');
    this.name = 'RecipeNotFoundError';
  }
}

export class RecipePhotoNotFoundError extends Error {
  constructor() {
    super('Recipe photo not found');
    this.name = 'RecipePhotoNotFoundError';
  }
}

export class RecipeIdTakenError extends Error {
  constructor() {
    super('That recipe id belongs to another member');
    this.name = 'RecipeIdTakenError';
  }
}

export class NotRecipeAuthorError extends Error {
  constructor() {
    super('Only the author can change this recipe');
    this.name = 'NotRecipeAuthorError';
  }
}

/** Liking or rating your own recipe. Mapped to 409, like liking your own workout. */
export class OwnRecipeActionError extends Error {
  constructor() {
    super('You cannot like or rate your own recipe');
    this.name = 'OwnRecipeActionError';
  }
}

export class RecipeStepNotFoundError extends Error {
  constructor() {
    super('That step does not exist in this recipe');
    this.name = 'RecipeStepNotFoundError';
  }
}

/** Logging is refused rather than logging a meal with invented zeros. */
export class RecipeMacrosMissingError extends Error {
  constructor() {
    super('This recipe has no estimated macros, so it cannot be added to the day');
    this.name = 'RecipeMacrosMissingError';
  }
}

export function encodeRecipeCursor(cursor: RecipeCursor): string {
  return btoa(`${cursor.createdAtMs}|${cursor.id}`).replace(/=+$/, '');
}

/** A malformed cursor reads as the first page rather than an error: it carries no authority. */
export function decodeRecipeCursor(raw: string | undefined): RecipeCursor | null {
  if (!raw) return null;
  try {
    const [ms, id] = atob(raw).split('|');
    const createdAtMs = Number(ms);
    if (!id || !Number.isFinite(createdAtMs)) return null;
    return { createdAtMs, id };
  } catch {
    return null;
  }
}

/** prep + cook, or null when the author declared neither. */
export function totalMinutes(recipe: { prepMinutes: number | null; cookMinutes: number | null }): number | null {
  if (recipe.prepMinutes === null && recipe.cookMinutes === null) return null;
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
}

function toSummaryDto(recipe: RecipeSummaryRecord, viewerId: string): RecipeSummaryDto {
  return {
    id: recipe.id,
    author: { id: recipe.authorId, displayName: recipe.authorName },
    title: recipe.title,
    coverPhotoId: recipe.coverPhotoId,
    totalMinutes: totalMinutes(recipe),
    servings: recipe.servings,
    tags: recipe.tags as RecipeTag[],
    macros: recipe.macros,
    likeCount: recipe.likeCount,
    viewerHasLiked: recipe.viewerHasLiked,
    ratingCount: recipe.ratingCount,
    ratingAverage: recipe.ratingAverage,
    viewerRating: recipe.viewerRating,
    isMine: recipe.authorId === viewerId,
    createdAt: recipe.createdAt.toISOString(),
  };
}

function toDetailDto(recipe: RecipeDetailRecord, viewerId: string): RecipeDetailDto {
  return {
    ...toSummaryDto(recipe, viewerId),
    description: recipe.description,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients: recipe.ingredients.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      unit: i.unit,
      name: i.name,
      optional: i.optional,
      substitutes: i.substitutes.map((s) => ({
        id: s.id,
        name: s.name,
        quantity: s.quantity,
        unit: s.unit,
        note: s.note,
      })),
    })),
    steps: recipe.steps.map((s) => ({ order: s.order, text: s.text, minutes: s.minutes, photoId: s.photoId })),
    updatedAt: recipe.updatedAt.toISOString(),
  };
}

/**
 * Steps are ordered by their position in the array, not by the `order` the client sent: a duplicate or a
 * gap would otherwise break the key a step photo is stored under.
 */
function toSteps(steps: CreateRecipeRequest['steps']): Array<Omit<RecipeStep, 'photoId'>> {
  return steps.map((s, i) => ({ order: i + 1, text: s.text, minutes: s.minutes }));
}

export class RecipesUseCases {
  constructor(
    private readonly repo: RecipeRepository,
    private readonly storage: PhotoStorage | null,
    private readonly meals: MealLogPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(viewerId: string, query: RecipeQuery): Promise<RecipePageDto> {
    const items = await this.repo.list({
      viewerId,
      cursor: decodeRecipeCursor(query.cursor),
      limit: RECIPE_PAGE_SIZE,
      q: query.q,
      tag: query.tag,
      maxMinutes: query.maxMinutes,
      ingredient: query.ingredient,
      authorId: query.authorId,
    });
    const last = items.length === RECIPE_PAGE_SIZE ? items[items.length - 1] : undefined;
    return {
      items: items.map((r) => toSummaryDto(r, viewerId)),
      nextCursor: last ? encodeRecipeCursor({ createdAtMs: last.createdAt.getTime(), id: last.id }) : null,
    };
  }

  async detail(viewerId: string, recipeId: string): Promise<RecipeDetailDto> {
    const recipe = await this.repo.findDetail(viewerId, recipeId);
    if (!recipe) throw new RecipeNotFoundError();
    return toDetailDto(recipe, viewerId);
  }

  async create(viewerId: string, body: CreateRecipeRequest): Promise<RecipeDetailDto> {
    const record: RecipeDraftRecord = {
      id: body.id,
      authorId: viewerId,
      title: body.title,
      description: body.description,
      prepMinutes: body.prepMinutes,
      cookMinutes: body.cookMinutes,
      servings: body.servings,
      tags: body.tags,
      macros: body.macros,
      ingredients: body.ingredients.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        unit: i.unit,
        name: i.name,
        optional: i.optional,
        substitutes: i.substitutes.map((s) => ({
          id: s.id,
          name: s.name,
          quantity: s.quantity,
          unit: s.unit,
          note: s.note,
        })),
      })),
      steps: toSteps(body.steps),
    };
    const outcome = await this.repo.create(record, this.now().getTime());
    if (outcome === 'taken') throw new RecipeIdTakenError();
    return this.requireDetail(viewerId, body.id);
  }

  async update(viewerId: string, recipeId: string, body: UpdateRecipeRequest): Promise<RecipeDetailDto> {
    await this.requireAuthor(viewerId, recipeId);
    const steps = toSteps(body.steps);
    await this.repo.update(
      recipeId,
      {
        title: body.title,
        description: body.description,
        prepMinutes: body.prepMinutes,
        cookMinutes: body.cookMinutes,
        servings: body.servings,
        tags: body.tags,
        macros: body.macros,
        ingredients: body.ingredients.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          unit: i.unit,
          name: i.name,
          optional: i.optional,
          substitutes: i.substitutes.map((s) => ({
            id: s.id,
            name: s.name,
            quantity: s.quantity,
            unit: s.unit,
            note: s.note,
          })),
        })),
        steps,
      },
      this.now().getTime(),
    );
    // Steps that no longer exist cannot keep their photo.
    const orphaned = await this.repo.pruneStepPhotos(recipeId, steps.length);
    if (this.storage) {
      for (const key of orphaned) await this.storage.delete(key).catch(() => undefined);
    }
    return this.requireDetail(viewerId, recipeId);
  }

  async like(viewerId: string, recipeId: string): Promise<LikeStateDto> {
    const recipe = await this.requireVisible(viewerId, recipeId);
    if (recipe.authorId === viewerId) throw new OwnRecipeActionError();
    await this.repo.like(recipeId, viewerId, this.now().getTime());
    return this.repo.likeState(recipeId, viewerId);
  }

  async unlike(viewerId: string, recipeId: string): Promise<LikeStateDto> {
    await this.requireVisible(viewerId, recipeId);
    await this.repo.unlike(recipeId, viewerId);
    return this.repo.likeState(recipeId, viewerId);
  }

  async rate(viewerId: string, recipeId: string, rating: number): Promise<RecipeRatingStatesDto> {
    const recipe = await this.requireVisible(viewerId, recipeId);
    if (recipe.authorId === viewerId) throw new OwnRecipeActionError();
    await this.repo.rate(recipeId, viewerId, rating, this.now().getTime());
    return this.repo.ratingState(recipeId, viewerId);
  }

  /**
   * "Añadir a hoy": the recipe becomes one meal in the calorie log. Per-serving macros are scaled by the
   * servings eaten and rounded once, so the entry's parts add up to the entry's totals.
   */
  async log(viewerId: string, recipeId: string, body: LogRecipeRequest): Promise<LogRecipeResponse> {
    const recipe = await this.repo.findDetail(viewerId, recipeId);
    if (!recipe) throw new RecipeNotFoundError();
    const macros = recipe.macros;
    // Logging a recipe nobody estimated would record a meal of zeros, which reads as a measurement.
    if (!macros) throw new RecipeMacrosMissingError();

    const scale = body.servings;
    const eaten = {
      calories: Math.round(macros.calories * scale),
      protein: Math.round(macros.protein * scale),
      carbs: Math.round(macros.carbs * scale),
      fat: Math.round(macros.fat * scale),
    };
    return this.meals.log({
      userId: viewerId,
      entryId: body.id,
      totalCalories: eaten.calories,
      totalProtein: eaten.protein,
      totalCarbs: eaten.carbs,
      totalFat: eaten.fat,
      foodItems: [{ name: recipe.title, ...eaten }],
    });
  }

  /** Cover (`stepOrder` null) or one step photo. Replaces whatever occupied that slot. */
  async putPhoto(
    viewerId: string,
    recipeId: string,
    stepOrder: number | null,
    bytes: Uint8Array,
    contentType: PhotoContentType,
  ): Promise<RecipePhotoDto> {
    const storage = this.requireStorage();
    const recipe = await this.requireAuthorDetail(viewerId, recipeId);
    if (stepOrder !== null && (stepOrder < 1 || stepOrder > recipe.steps.length)) {
      throw new RecipeStepNotFoundError();
    }
    const ext = sniffImage(bytes, contentType);
    const id = crypto.randomUUID();
    const key = `recipes/${viewerId}/${recipeId}/${id}.${ext}`;
    const previous = await this.repo.findPhotoByStep(recipeId, stepOrder);
    await storage.put(key, bytes, contentType);
    try {
      await this.repo.savePhoto({
        id,
        recipeId,
        stepOrder,
        storageKey: key,
        contentType,
        bytes: bytes.byteLength,
        createdAt: this.now().getTime(),
      });
    } catch (err) {
      await storage.delete(key);
      throw err;
    }
    if (previous) await storage.delete(previous.storageKey).catch(() => undefined);
    return { id, recipeId, stepOrder, contentType };
  }

  async photo(recipeId: string, photoId: string, viewerId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const storage = this.requireStorage();
    // Visibility first: a draft's photos are not readable by other members.
    await this.requireVisible(viewerId, recipeId);
    const photo = await this.repo.findPhoto(recipeId, photoId);
    if (!photo) throw new RecipePhotoNotFoundError();
    const object = await storage.get(photo.storageKey);
    if (!object) throw new RecipePhotoNotFoundError();
    return { bytes: object.bytes, contentType: photo.contentType };
  }

  private async requireDetail(viewerId: string, recipeId: string): Promise<RecipeDetailDto> {
    const recipe = await this.repo.findDetail(viewerId, recipeId);
    if (!recipe) throw new RecipeNotFoundError();
    return toDetailDto(recipe, viewerId);
  }

  private async requireVisible(viewerId: string, recipeId: string): Promise<RecipeSummaryRecord> {
    const recipe = await this.repo.findSummary(viewerId, recipeId);
    if (!recipe) throw new RecipeNotFoundError();
    return recipe;
  }

  private async requireAuthor(viewerId: string, recipeId: string): Promise<void> {
    const authorId = await this.repo.findAuthorId(recipeId);
    if (!authorId) throw new RecipeNotFoundError();
    if (authorId !== viewerId) throw new NotRecipeAuthorError();
  }

  private async requireAuthorDetail(viewerId: string, recipeId: string): Promise<RecipeDetailRecord> {
    await this.requireAuthor(viewerId, recipeId);
    const recipe = await this.repo.findDetail(viewerId, recipeId);
    if (!recipe) throw new RecipeNotFoundError();
    return recipe;
  }

  private requireStorage(): PhotoStorage {
    if (!this.storage) throw new PhotoStorageUnavailableError();
    return this.storage;
  }
}
