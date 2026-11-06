import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { profiles } from '@db/schema';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import { SqliteRecipeRepository } from '@/lib/contexts/recipes/infrastructure/sqlite/sqlite-recipes.repository';
import type { RecipeDraftRecord } from '@/lib/contexts/recipes/domain/recipes.repository';

const RECIPE_ID = '3a2f0923-3573-44c1-9975-88314590bb38';

describe('SqliteRecipeRepository.create', () => {
  let handle: TestDbHandle;
  let repo: SqliteRecipeRepository;
  let authorId: string;
  let otherId: string;

  beforeEach(async () => {
    handle = createTestDb();
    const [a] = await handle.db
      .insert(profiles)
      .values({ email: 'author@test.com', passwordHash: 'h', displayName: 'Autora', routineType: 'hombre', weightUnit: 'kg' })
      .returning();
    const [b] = await handle.db
      .insert(profiles)
      .values({ email: 'other@test.com', passwordHash: 'h', displayName: 'Otro', routineType: 'mujer', weightUnit: 'kg' })
      .returning();
    authorId = a.id;
    otherId = b.id;
    repo = new SqliteRecipeRepository(handle.db);
  });

  afterEach(() => {
    handle.close();
  });

  /** A draft (no cover), so only its author can read it back through `findDetail`. */
  function draft(overrides: Partial<RecipeDraftRecord> = {}): RecipeDraftRecord {
    return {
      id: RECIPE_ID,
      authorId,
      title: 'Pollo al limón con arroz',
      description: null,
      prepMinutes: 10,
      cookMinutes: 20,
      servings: 2,
      tags: ['alto-proteina'],
      macros: { calories: 480, protein: 38, carbs: 45, fat: 12 },
      ingredients: [
        {
          id: crypto.randomUUID(),
          quantity: 400,
          unit: 'g',
          name: 'Pechuga de pollo',
          optional: false,
          substitutes: [],
        },
      ],
      steps: [{ order: 1, text: 'Macera el pollo con el limón.', minutes: 10 }],
      ...overrides,
    };
  }

  it('writes the recipe and its children on the first attempt', async () => {
    const outcome = await repo.create(draft(), 1_000);

    expect(outcome).toBe('created');
    const saved = await repo.findDetail(authorId, RECIPE_ID);
    expect(saved?.title).toBe('Pollo al limón con arroz');
    expect(saved?.ingredients.map((i) => i.name)).toEqual(['Pechuga de pollo']);
    expect(saved?.steps).toHaveLength(1);
  });

  it('treats a replay by the same author as a repair, not a second recipe', async () => {
    await repo.create(draft(), 1_000);

    const outcome = await repo.create(
      draft({
        ingredients: [
          {
            id: crypto.randomUUID(),
            quantity: 500,
            unit: 'g',
            name: 'Muslo de pollo',
            optional: false,
            substitutes: [],
          },
        ],
        steps: [
          { order: 1, text: 'Macera el pollo con el limón.', minutes: 10 },
          { order: 2, text: 'Cocina el arroz 12 minutos.', minutes: 12 },
        ],
      }),
      2_000,
    );

    expect(outcome).toBe('replayed');
    const saved = await repo.findDetail(authorId, RECIPE_ID);
    expect(saved?.title).toBe('Pollo al limón con arroz');
    // The children were rewritten, not appended: a half-written attempt leaves no leftovers.
    expect(saved?.ingredients.map((i) => i.name)).toEqual(['Muslo de pollo']);
    expect(saved?.steps.map((s) => s.order)).toEqual([1, 2]);
  });

  it('leaves the recipe untouched when the id belongs to another member', async () => {
    await repo.create(draft(), 1_000);

    const outcome = await repo.create(
      draft({
        authorId: otherId,
        title: 'Receta pirateada',
        ingredients: [
          {
            id: crypto.randomUUID(),
            quantity: 1,
            unit: 'kg',
            name: 'Chocolate',
            optional: false,
            substitutes: [],
          },
        ],
      }),
      2_000,
    );

    expect(outcome).toBe('taken');
    const saved = await repo.findDetail(authorId, RECIPE_ID);
    expect(saved?.title).toBe('Pollo al limón con arroz');
    expect(saved?.ingredients.map((i) => i.name)).toEqual(['Pechuga de pollo']);
    expect(saved?.authorId).toBe(authorId);
    // The intruder still cannot see it, so the id did not change hands.
    expect(await repo.findDetail(otherId, RECIPE_ID)).toBeUndefined();
  });
});
