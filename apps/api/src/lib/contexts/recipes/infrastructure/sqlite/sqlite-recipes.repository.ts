// src/lib/contexts/recipes/infrastructure/sqlite/sqlite-recipes.repository.ts
//
// SQLite/D1 implementation of the recipe book (DR-0029).
//
// A list page is ONE query: the two counters and the viewer's rating are correlated subqueries, so adding
// likes and ratings does not multiply rows. Ingredients, substitutes, steps and photos are loaded only for a
// detail view, always batched.

import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql, like as sqlLike, type SQL } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  profiles,
  recipeIngredients,
  recipeLikes,
  recipePhotos,
  recipeRatings,
  recipeSteps,
  recipeSubstitutes,
  recipes,
} from '@db/schema';
import type {
  RecipeDetailRecord,
  RecipeDraftRecord,
  RecipeIngredient,
  RecipePhotoRecord,
  RecipeRepository,
  RecipeSubstitute,
  RecipeSummaryRecord,
  RecipeListFilters,
} from '../../domain/recipes.repository';

type SummaryRow = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string | null;
  coverPhotoId: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number;
  tags: string[] | null;
  macros: RecipeSummaryRecord['macros'];
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  viewerLikes: number;
  ratingCount: number;
  ratingAverage: number | null;
  viewerRating: number | null;
};

export class SqliteRecipeRepository implements RecipeRepository {
  constructor(private readonly db: Db) {}

  /** A recipe is visible when it has a cover, or when the viewer wrote it and it is still a draft. */
  private hasCover(): SQL {
    return sql`exists (select 1 from ${recipePhotos} where ${recipePhotos.recipeId} = ${recipes.id} and ${recipePhotos.stepOrder} is null)`;
  }

  private ingredientExists(term: string): SQL {
    return sql`exists (select 1 from ${recipeIngredients} where ${recipeIngredients.recipeId} = ${recipes.id} and ${recipeIngredients.name} like ${`%${term}%`})`;
  }

  private summaryQuery(viewerId: string) {
    return this.db
      .select({
        id: recipes.id,
        authorId: recipes.authorId,
        authorName: profiles.displayName,
        title: recipes.title,
        description: recipes.description,
        coverPhotoId: sql<
          string | null
        >`(select ${recipePhotos.id} from ${recipePhotos} where ${recipePhotos.recipeId} = ${recipes.id} and ${recipePhotos.stepOrder} is null)`,
        prepMinutes: recipes.prepMinutes,
        cookMinutes: recipes.cookMinutes,
        servings: recipes.servings,
        tags: recipes.tags,
        macros: recipes.macros,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
        likeCount: sql<number>`(select count(*) from ${recipeLikes} where ${recipeLikes.recipeId} = ${recipes.id})`.mapWith(
          Number,
        ),
        viewerLikes: sql<number>`(select count(*) from ${recipeLikes} where ${recipeLikes.recipeId} = ${recipes.id} and ${recipeLikes.userId} = ${viewerId})`.mapWith(
          Number,
        ),
        ratingCount: sql<number>`(select count(*) from ${recipeRatings} where ${recipeRatings.recipeId} = ${recipes.id})`.mapWith(
          Number,
        ),
        // No mapWith: Number(null) would turn "nobody rated it" into a real zero-star average.
        ratingAverage: sql<
          number | null
        >`(select avg(${recipeRatings.rating}) from ${recipeRatings} where ${recipeRatings.recipeId} = ${recipes.id})`,
        viewerRating: sql<
          number | null
        >`(select ${recipeRatings.rating} from ${recipeRatings} where ${recipeRatings.recipeId} = ${recipes.id} and ${recipeRatings.userId} = ${viewerId})`,
      })
      .from(recipes)
      .innerJoin(profiles, eq(profiles.id, recipes.authorId))
      .$dynamic();
  }

  private toSummary(row: SummaryRow): RecipeSummaryRecord {
    return {
      id: row.id,
      authorId: row.authorId,
      authorName: row.authorName,
      title: row.title,
      coverPhotoId: row.coverPhotoId,
      prepMinutes: row.prepMinutes,
      cookMinutes: row.cookMinutes,
      servings: row.servings,
      tags: row.tags ?? [],
      macros: row.macros ?? null,
      likeCount: row.likeCount,
      viewerHasLiked: Number(row.viewerLikes) > 0,
      ratingCount: row.ratingCount,
      ratingAverage: row.ratingAverage == null ? null : Number(row.ratingAverage),
      viewerRating: row.viewerRating == null ? null : Number(row.viewerRating),
      createdAt: row.createdAt,
    };
  }

  async list(filters: RecipeListFilters): Promise<RecipeSummaryRecord[]> {
    const where: SQL[] = [
      isNull(profiles.deletedAt),
      // Published recipes for everyone; a draft only for the member who wrote it.
      or(this.hasCover(), eq(recipes.authorId, filters.viewerId))!,
    ];
    if (filters.authorId) where.push(eq(recipes.authorId, filters.authorId));
    if (filters.tag) {
      where.push(sql`exists (select 1 from json_each(${recipes.tags}) where json_each.value = ${filters.tag})`);
    }
    if (filters.maxMinutes !== undefined) {
      // A recipe that declares neither time does not satisfy a time ceiling.
      where.push(
        sql`(${recipes.prepMinutes} is not null or ${recipes.cookMinutes} is not null) and (coalesce(${recipes.prepMinutes}, 0) + coalesce(${recipes.cookMinutes}, 0)) <= ${filters.maxMinutes}`,
      );
    }
    if (filters.ingredient) where.push(this.ingredientExists(filters.ingredient));
    if (filters.q) where.push(or(sqlLike(recipes.title, `%${filters.q}%`), this.ingredientExists(filters.q))!);
    if (filters.cursor) {
      const at = new Date(filters.cursor.createdAtMs);
      where.push(or(lt(recipes.createdAt, at), and(eq(recipes.createdAt, at), lt(recipes.id, filters.cursor.id)))!);
    }

    const rows = (await this.summaryQuery(filters.viewerId)
      .where(and(...where))
      .orderBy(desc(recipes.createdAt), desc(recipes.id))
      .limit(filters.limit)) as SummaryRow[];
    return rows.map((row) => this.toSummary(row));
  }

  async findSummary(viewerId: string, recipeId: string): Promise<RecipeSummaryRecord | undefined> {
    const [row] = (await this.summaryQuery(viewerId)
      .where(
        and(
          eq(recipes.id, recipeId),
          isNull(profiles.deletedAt),
          or(this.hasCover(), eq(recipes.authorId, viewerId))!,
        ),
      )
      .limit(1)) as SummaryRow[];
    return row ? this.toSummary(row) : undefined;
  }

  async findDetail(viewerId: string, recipeId: string): Promise<RecipeDetailRecord | undefined> {
    const [row] = (await this.summaryQuery(viewerId)
      .where(
        and(
          eq(recipes.id, recipeId),
          isNull(profiles.deletedAt),
          or(this.hasCover(), eq(recipes.authorId, viewerId))!,
        ),
      )
      .limit(1)) as SummaryRow[];
    if (!row) return undefined;

    const [ingredientRows, stepRows, photos] = await Promise.all([
      this.db
        .select({
          id: recipeIngredients.id,
          quantity: recipeIngredients.quantity,
          unit: recipeIngredients.unit,
          name: recipeIngredients.name,
          optional: recipeIngredients.optional,
        })
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, recipeId))
        .orderBy(asc(recipeIngredients.position)),
      this.db
        .select({ position: recipeSteps.position, text: recipeSteps.text, minutes: recipeSteps.minutes })
        .from(recipeSteps)
        .where(eq(recipeSteps.recipeId, recipeId))
        .orderBy(asc(recipeSteps.position)),
      this.db
        .select({ id: recipePhotos.id, stepOrder: recipePhotos.stepOrder })
        .from(recipePhotos)
        .where(eq(recipePhotos.recipeId, recipeId)),
    ]);

    const substituteRows = ingredientRows.length
      ? await this.db
          .select({
            id: recipeSubstitutes.id,
            ingredientId: recipeSubstitutes.ingredientId,
            name: recipeSubstitutes.name,
            quantity: recipeSubstitutes.quantity,
            unit: recipeSubstitutes.unit,
            note: recipeSubstitutes.note,
          })
          .from(recipeSubstitutes)
          .where(
            inArray(
              recipeSubstitutes.ingredientId,
              ingredientRows.map((i) => i.id),
            ),
          )
          .orderBy(asc(recipeSubstitutes.position))
      : [];

    const substitutesByIngredient = new Map<string, RecipeSubstitute[]>();
    for (const s of substituteRows) {
      const list = substitutesByIngredient.get(s.ingredientId) ?? [];
      list.push({ id: s.id, name: s.name, quantity: s.quantity, unit: s.unit, note: s.note });
      substitutesByIngredient.set(s.ingredientId, list);
    }

    const ingredients: RecipeIngredient[] = ingredientRows.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      unit: i.unit,
      name: i.name,
      optional: i.optional,
      substitutes: substitutesByIngredient.get(i.id) ?? [],
    }));

    const photoByStep = new Map<number, string>();
    for (const p of photos) if (p.stepOrder !== null) photoByStep.set(p.stepOrder, p.id);

    return {
      ...this.toSummary(row),
      description: row.description,
      updatedAt: row.updatedAt,
      ingredients,
      steps: stepRows.map((s) => ({
        order: s.position,
        text: s.text,
        minutes: s.minutes,
        photoId: photoByStep.get(s.position) ?? null,
      })),
    };
  }

  async findAuthorId(recipeId: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ authorId: recipes.authorId })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);
    return row?.authorId;
  }

  async create(input: RecipeDraftRecord, at: number): Promise<boolean> {
    const inserted = await this.db
      .insert(recipes)
      .values({
        id: input.id,
        authorId: input.authorId,
        title: input.title,
        description: input.description,
        prepMinutes: input.prepMinutes,
        cookMinutes: input.cookMinutes,
        servings: input.servings,
        tags: input.tags,
        macros: input.macros,
        createdAt: new Date(at),
        updatedAt: new Date(at),
      })
      .onConflictDoNothing()
      .returning({ id: recipes.id });
    // A replay of the same create converges on the recipe that already exists, and rewriting the children
    // repairs an earlier attempt that failed halfway.
    await this.replaceChildren(input.id, input);
    return inserted.length > 0;
  }

  /**
   * D1 has no interactive transactions, so the edit is a sequence of idempotent statements: children are
   * dropped and written again, and a retry of the same PUT converges to the same state (ADR-025).
   */
  async update(
    recipeId: string,
    input: Omit<RecipeDraftRecord, 'id' | 'authorId'>,
    at: number,
  ): Promise<void> {
    await this.db
      .update(recipes)
      .set({
        title: input.title,
        description: input.description,
        prepMinutes: input.prepMinutes,
        cookMinutes: input.cookMinutes,
        servings: input.servings,
        tags: input.tags,
        macros: input.macros,
        updatedAt: new Date(at),
      })
      .where(eq(recipes.id, recipeId));
    await this.replaceChildren(recipeId, input);
  }

  private async replaceChildren(
    recipeId: string,
    input: Pick<RecipeDraftRecord, 'ingredients' | 'steps'>,
  ): Promise<void> {
    // Substitutes go with their ingredient through ON DELETE CASCADE.
    await this.db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
    await this.db.delete(recipeSteps).where(eq(recipeSteps.recipeId, recipeId));
    if (input.ingredients.length > 0) {
      await this.db.insert(recipeIngredients).values(
        input.ingredients.map((ing, i) => ({
          id: ing.id,
          recipeId,
          position: i + 1,
          quantity: ing.quantity,
          unit: ing.unit,
          name: ing.name,
          optional: ing.optional,
        })),
      );
      const substitutes = input.ingredients.flatMap((ing) =>
        ing.substitutes.map((sub, j) => ({
          id: sub.id,
          ingredientId: ing.id,
          position: j + 1,
          name: sub.name,
          quantity: sub.quantity,
          unit: sub.unit,
          note: sub.note,
        })),
      );
      if (substitutes.length > 0) await this.db.insert(recipeSubstitutes).values(substitutes);
    }
    if (input.steps.length > 0) {
      await this.db.insert(recipeSteps).values(
        input.steps.map((step) => ({
          recipeId,
          position: step.order,
          text: step.text,
          minutes: step.minutes,
        })),
      );
    }
  }

  async like(recipeId: string, userId: string, at: number): Promise<void> {
    await this.db.insert(recipeLikes).values({ recipeId, userId, createdAt: at }).onConflictDoNothing();
  }

  async unlike(recipeId: string, userId: string): Promise<void> {
    await this.db
      .delete(recipeLikes)
      .where(and(eq(recipeLikes.recipeId, recipeId), eq(recipeLikes.userId, userId)));
  }

  async likeState(
    recipeId: string,
    viewerId: string,
  ): Promise<{ likeCount: number; viewerHasLiked: boolean }> {
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        mine: sql<number>`coalesce(sum(case when ${recipeLikes.userId} = ${viewerId} then 1 else 0 end), 0)`.mapWith(
          Number,
        ),
      })
      .from(recipeLikes)
      .where(eq(recipeLikes.recipeId, recipeId));
    return { likeCount: row?.count ?? 0, viewerHasLiked: (row?.mine ?? 0) > 0 };
  }

  async rate(recipeId: string, userId: string, rating: number, at: number): Promise<void> {
    await this.db
      .insert(recipeRatings)
      .values({ recipeId, userId, rating, createdAt: at, updatedAt: at })
      .onConflictDoUpdate({
        target: [recipeRatings.recipeId, recipeRatings.userId],
        set: { rating, updatedAt: at },
      });
  }

  async ratingState(
    recipeId: string,
    viewerId: string,
  ): Promise<{ ratingCount: number; ratingAverage: number | null; viewerRating: number | null }> {
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        average: sql<number | null>`avg(${recipeRatings.rating})`,
        mine: sql<number | null>`max(case when ${recipeRatings.userId} = ${viewerId} then ${recipeRatings.rating} end)`,
      })
      .from(recipeRatings)
      .where(eq(recipeRatings.recipeId, recipeId));
    return {
      ratingCount: row?.count ?? 0,
      ratingAverage: row?.average == null ? null : Number(row.average),
      viewerRating: row?.mine == null ? null : Number(row.mine),
    };
  }

  async findPhoto(recipeId: string, photoId: string): Promise<RecipePhotoRecord | undefined> {
    const [row] = await this.db
      .select({
        id: recipePhotos.id,
        recipeId: recipePhotos.recipeId,
        stepOrder: recipePhotos.stepOrder,
        storageKey: recipePhotos.storageKey,
        contentType: recipePhotos.contentType,
      })
      .from(recipePhotos)
      .where(and(eq(recipePhotos.recipeId, recipeId), eq(recipePhotos.id, photoId)))
      .limit(1);
    return row;
  }

  async findPhotoByStep(recipeId: string, stepOrder: number | null): Promise<RecipePhotoRecord | undefined> {
    const target =
      stepOrder === null ? isNull(recipePhotos.stepOrder) : eq(recipePhotos.stepOrder, stepOrder);
    const [row] = await this.db
      .select({
        id: recipePhotos.id,
        recipeId: recipePhotos.recipeId,
        stepOrder: recipePhotos.stepOrder,
        storageKey: recipePhotos.storageKey,
        contentType: recipePhotos.contentType,
      })
      .from(recipePhotos)
      .where(and(eq(recipePhotos.recipeId, recipeId), target))
      .limit(1);
    return row;
  }

  async savePhoto(record: RecipePhotoRecord & { bytes: number; createdAt: number }): Promise<void> {
    // Explicit delete-then-insert: the unique indexes over `recipe_photos` are partial, and a partial
    // conflict target is not portable between D1 and the test driver.
    const slot =
      record.stepOrder === null
        ? isNull(recipePhotos.stepOrder)
        : eq(recipePhotos.stepOrder, record.stepOrder);
    await this.db
      .delete(recipePhotos)
      .where(and(eq(recipePhotos.recipeId, record.recipeId), slot));
    await this.db.insert(recipePhotos).values(record);
  }

  async deletePhoto(recipeId: string, photoId: string): Promise<void> {
    await this.db
      .delete(recipePhotos)
      .where(and(eq(recipePhotos.recipeId, recipeId), eq(recipePhotos.id, photoId)));
  }

  async pruneStepPhotos(recipeId: string, stepCount: number): Promise<string[]> {
    const stale = await this.db
      .select({ id: recipePhotos.id, storageKey: recipePhotos.storageKey })
      .from(recipePhotos)
      .where(
        and(
          eq(recipePhotos.recipeId, recipeId),
          isNotNull(recipePhotos.stepOrder),
          gt(recipePhotos.stepOrder, stepCount),
        ),
      );
    if (stale.length === 0) return [];
    await this.db.delete(recipePhotos).where(
      inArray(
        recipePhotos.id,
        stale.map((s) => s.id),
      ),
    );
    return stale.map((s) => s.storageKey);
  }
}
