// End-to-end tests of the recipe book (DR-0029): shared recipes with likes and ratings, over real HTTP with
// the real migrations.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import * as schema from '@db/schema';
import { seedReferenceData } from '../../db/seed';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { InMemoryPhotoStorage } from '@/lib/contexts/private-photos/infrastructure/in-memory-photo-storage';
import { createApp } from '../../src/nest/create-app';
import {
  logRecipeResponseSchema,
  recipeDetailSchema,
  recipePageSchema,
  recipePhotoSchema,
  recipeRatingStatesSchema,
  recipeLikeStateSchema,
  sessionResponseSchema,
  type CreateRecipeRequest,
} from '@gym-up/contracts';

const fakeHasher: PasswordHasher = {
  hash: async (p) => `fake$${p}`,
  verify: async (p, h) => h === `fake$${p}`,
};

/** The first bytes of a real PNG, which is all `sniffImage` reads. */
const PNG_BASE64 = 'iVBORw0KGgo=';

let app: INestApplication;
let bareApp: INestApplication;
let storage: InMemoryPhotoStorage;
let base: string;
let bareBase: string;

async function listen(a: INestApplication) {
  await a.listen(0, '127.0.0.1');
  return (await a.getUrl()).replace('[::1]', '127.0.0.1');
}

async function http(root: string, method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(root + path, {
    method,
    headers: {
      ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}

async function register(root: string, email: string) {
  const r = await http(root, 'POST', '/auth/register', {
    body: { email, password: 'longenough', displayName: 'Cocinero', routineType: 'hombre', weightUnit: 'kg' },
  });
  expect(r.status).toBe(201);
  return sessionResponseSchema.parse(r.json);
}

function draft(overrides: Partial<CreateRecipeRequest> = {}): CreateRecipeRequest {
  return {
    id: crypto.randomUUID(),
    title: 'Bowl de pollo y quinoa',
    description: 'Rápido y aguanta la nevera dos días.',
    prepMinutes: 10,
    cookMinutes: 20,
    servings: 2,
    tags: ['alto-proteina'],
    macros: { calories: 520, protein: 42, carbs: 48, fat: 16 },
    ingredients: [
      {
        id: crypto.randomUUID(),
        quantity: 300,
        unit: 'g',
        name: 'Pechuga de pollo',
        optional: false,
        substitutes: [
          { id: crypto.randomUUID(), name: 'Pavo', quantity: 300, unit: 'g', note: 'algo más seca' },
        ],
      },
      { id: crypto.randomUUID(), quantity: null, unit: null, name: 'Sal', optional: true, substitutes: [] },
    ],
    steps: [
      { order: 1, text: 'Cuece la quinoa 15 minutos.', minutes: 15 },
      { order: 2, text: 'Saltea el pollo y monta el bol.', minutes: 5 },
    ],
    ...overrides,
  };
}

async function createRecipe(token: string, body: CreateRecipeRequest) {
  const r = await http(base, 'POST', '/recipes', { token, body });
  expect(r.status).toBe(201);
  return recipeDetailSchema.parse(r.json);
}

async function uploadCover(token: string, recipeId: string) {
  const r = await http(base, 'POST', `/recipes/${recipeId}/photos`, {
    token,
    body: { imageBase64: PNG_BASE64, mimeType: 'image/png', stepOrder: null },
  });
  expect(r.status).toBe(201);
  return recipePhotoSchema.parse(r.json);
}

beforeAll(async () => {
  const dir = join(__dirname, '../../db/migrations');
  const migrate = (sqlite: Database.Database) => {
    sqlite.pragma('foreign_keys = ON');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      sqlite.exec(readFileSync(join(dir, file), 'utf8'));
    }
  };

  const sqlite = new Database(':memory:');
  migrate(sqlite);
  const db = drizzle(sqlite, { schema }) as unknown as Db;
  await seedReferenceData(db);
  storage = new InMemoryPhotoStorage();
  app = (await createApp({ db, hasher: fakeHasher, photoStorage: storage })).app;
  base = await listen(app);

  // A second driver with no object store: photo endpoints must answer 503, not crash.
  const bareSqlite = new Database(':memory:');
  migrate(bareSqlite);
  const bareDb = drizzle(bareSqlite, { schema }) as unknown as Db;
  await seedReferenceData(bareDb);
  bareApp = (await createApp({ db: bareDb, hasher: fakeHasher })).app;
  bareBase = await listen(bareApp);
});

afterAll(async () => {
  await app.close();
  await bareApp.close();
});

describe('recipes', () => {
  it('keeps a recipe without a cover as a private draft, then publishes it with one', async () => {
    const author = await register(base, 'recipe-author@example.com');
    const other = await register(base, 'recipe-other@example.com');
    const created = await createRecipe(author.token, draft());

    expect(created.coverPhotoId).toBeNull();
    expect(created.isMine).toBe(true);
    expect(created.totalMinutes).toBe(30);
    expect(created.steps.map((s) => s.order)).toEqual([1, 2]);
    expect(created.ingredients[0]?.substitutes[0]?.name).toBe('Pavo');

    // The author still sees the draft; nobody else does.
    const mine = recipePageSchema.parse((await http(base, 'GET', '/recipes', { token: author.token })).json);
    expect(mine.items.map((r) => r.id)).toContain(created.id);
    const theirs = recipePageSchema.parse((await http(base, 'GET', '/recipes', { token: other.token })).json);
    expect(theirs.items.map((r) => r.id)).not.toContain(created.id);
    expect((await http(base, 'GET', `/recipes/${created.id}`, { token: other.token })).status).toBe(404);

    const cover = await uploadCover(author.token, created.id);
    expect(cover.stepOrder).toBeNull();

    const published = recipeDetailSchema.parse(
      (await http(base, 'GET', `/recipes/${created.id}`, { token: other.token })).json,
    );
    expect(published.coverPhotoId).toBe(cover.id);
    expect(published.isMine).toBe(false);

    // The bytes come back through the same authenticated route.
    const file = await fetch(`${base}/recipes/${created.id}/photos/${cover.id}/file`, {
      headers: { authorization: `Bearer ${other.token}` },
    });
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
  });

  it('likes idempotently, refuses the author, and rates one value per member', async () => {
    const author = await register(base, 'recipe-like-author@example.com');
    const fan = await register(base, 'recipe-fan@example.com');
    const created = await createRecipe(author.token, draft());
    await uploadCover(author.token, created.id);

    const beforeAnyRating = recipePageSchema.parse(
      (await http(base, 'GET', '/recipes', { token: fan.token })).json,
    );
    expect(beforeAnyRating.items.find((r) => r.id === created.id)?.ratingAverage).toBeNull();

    const first = recipeLikeStateSchema.parse(
      (await http(base, 'PUT', `/recipes/${created.id}/like`, { token: fan.token })).json,
    );
    expect(first).toEqual({ likeCount: 1, viewerHasLiked: true });
    // Liking twice is one like.
    const twice = recipeLikeStateSchema.parse(
      (await http(base, 'PUT', `/recipes/${created.id}/like`, { token: fan.token })).json,
    );
    expect(twice).toEqual({ likeCount: 1, viewerHasLiked: true });
    expect((await http(base, 'PUT', `/recipes/${created.id}/like`, { token: author.token })).status).toBe(409);
    expect((await http(base, 'DELETE', `/recipes/${created.id}/like`, { token: fan.token })).json).toEqual({
      likeCount: 0,
      viewerHasLiked: false,
    });

    await http(base, 'PUT', `/recipes/${created.id}/rating`, { token: fan.token, body: { rating: 4 } });
    const upgraded = recipeRatingStatesSchema.parse(
      (await http(base, 'PUT', `/recipes/${created.id}/rating`, { token: fan.token, body: { rating: 5 } })).json,
    );
    // Rating again replaces the value instead of adding a second one.
    expect(upgraded).toEqual({ ratingCount: 1, ratingAverage: 5, viewerRating: 5 });
    expect(
      (await http(base, 'PUT', `/recipes/${created.id}/rating`, { token: author.token, body: { rating: 5 } })).status,
    ).toBe(409);
    expect(
      (await http(base, 'PUT', `/recipes/${created.id}/rating`, { token: fan.token, body: { rating: 6 } })).status,
    ).toBe(400);

    const list = recipePageSchema.parse((await http(base, 'GET', '/recipes', { token: author.token })).json);
    const card = list.items.find((r) => r.id === created.id);
    expect(card).toMatchObject({ ratingCount: 1, ratingAverage: 5, likeCount: 0, viewerRating: null });
  });

  it('filters by text, ingredient, tag and total time', async () => {
    const author = await register(base, 'recipe-filter@example.com');
    const quick = await createRecipe(
      author.token,
      draft({ title: 'Tortilla rápida', prepMinutes: 5, cookMinutes: 5, tags: ['desayuno'] }),
    );
    const slow = await createRecipe(
      author.token,
      draft({ title: 'Cocido lento', prepMinutes: 20, cookMinutes: 180, tags: ['meal-prep'] }),
    );
    await uploadCover(author.token, quick.id);
    await uploadCover(author.token, slow.id);

    const byText = recipePageSchema.parse(
      (await http(base, 'GET', '/recipes?q=Tortilla', { token: author.token })).json,
    );
    expect(byText.items.map((r) => r.id)).toEqual([quick.id]);

    const byIngredient = recipePageSchema.parse(
      (
        await http(base, 'GET', `/recipes?ingredient=pollo&authorId=${author.user.id}`, {
          token: author.token,
        })
      ).json,
    );
    expect(byIngredient.items.map((r) => r.id)).toEqual([slow.id, quick.id]);

    const byTag = recipePageSchema.parse(
      (await http(base, 'GET', '/recipes?tag=meal-prep', { token: author.token })).json,
    );
    expect(byTag.items.map((r) => r.id)).toEqual([slow.id]);

    const byTime = recipePageSchema.parse(
      (await http(base, 'GET', '/recipes?maxMinutes=15', { token: author.token })).json,
    );
    expect(byTime.items.map((r) => r.id)).toEqual([quick.id]);
  });

  it('replaces the whole draft on edit and keeps the edit to the author', async () => {
    const author = await register(base, 'recipe-edit@example.com');
    const stranger = await register(base, 'recipe-stranger@example.com');
    const created = await createRecipe(author.token, draft());
    await uploadCover(author.token, created.id);

    const edited = recipeDetailSchema.parse(
      (
        await http(base, 'PUT', `/recipes/${created.id}`, {
          token: author.token,
          body: draft({
            title: 'Bowl de pavo',
            steps: [{ order: 1, text: 'Mezcla todo en frío.', minutes: null }],
          }),
        })
      ).json,
    );
    expect(edited.title).toBe('Bowl de pavo');
    expect(edited.steps).toHaveLength(1);
    // The cover is untouched by a text edit: the recipe stays published.
    expect(edited.coverPhotoId).not.toBeNull();

    expect(
      (await http(base, 'PUT', `/recipes/${created.id}`, { token: stranger.token, body: draft() })).status,
    ).toBe(403);
    expect(
      (await http(base, 'PUT', `/recipes/${crypto.randomUUID()}`, { token: author.token, body: draft() })).status,
    ).toBe(404);
  });

  it('is idempotent on create and rejects an id owned by someone else', async () => {
    const author = await register(base, 'recipe-idem@example.com');
    const intruder = await register(base, 'recipe-intruder@example.com');
    const body = draft();
    const first = await createRecipe(author.token, body);
    const again = await createRecipe(author.token, body);
    expect(again.id).toBe(first.id);
    expect(again.steps).toHaveLength(2);
    expect((await http(base, 'POST', '/recipes', { token: intruder.token, body })).status).toBe(409);
  });

  it('validates a recipe and refuses a photo of a step that does not exist', async () => {
    const author = await register(base, 'recipe-valid@example.com');
    const created = await createRecipe(author.token, draft());

    expect(
      (await http(base, 'POST', '/recipes', { token: author.token, body: { ...draft(), title: '' } })).status,
    ).toBe(400);
    expect(
      (await http(base, 'POST', '/recipes', { token: author.token, body: { ...draft(), ingredients: [] } })).status,
    ).toBe(400);

    const badStep = await http(base, 'POST', `/recipes/${created.id}/photos`, {
      token: author.token,
      body: { imageBase64: PNG_BASE64, mimeType: 'image/png', stepOrder: 5 },
    });
    expect(badStep.status).toBe(404);

    const notAnImage = await http(base, 'POST', `/recipes/${created.id}/photos`, {
      token: author.token,
      body: { imageBase64: 'bm90IGFuIGltYWdl', mimeType: 'image/png', stepOrder: null },
    });
    expect(notAnImage.status).toBe(415);
  });

  it('adds a recipe to today, scaling its per-serving macros by the servings eaten', async () => {
    const author = await register(base, 'recipe-log@example.com');
    const created = await createRecipe(author.token, draft());
    await uploadCover(author.token, created.id);

    const entryId = crypto.randomUUID();
    const full = logRecipeResponseSchema.parse(
      (
        await http(base, 'POST', `/recipes/${created.id}/log`, {
          token: author.token,
          body: { id: entryId, servings: 2 },
        })
      ).json,
    );
    // Per-serving 520/42/48/16 x 2 servings.
    expect(full).toMatchObject({
      id: entryId,
      totalCalories: 1040,
      totalProtein: 84,
      totalCarbs: 96,
      totalFat: 32,
      userEdited: true,
      hasPhoto: false,
    });
    expect(full.foodItems).toHaveLength(1);
    expect(full.foodItems[0]).toMatchObject({
      name: created.title,
      calories: 1040,
      protein: 84,
      carbs: 96,
      fat: 32,
    });

    // The same request replayed is the same entry, not a second meal.
    const replay = logRecipeResponseSchema.parse(
      (
        await http(base, 'POST', `/recipes/${created.id}/log`, {
          token: author.token,
          body: { id: entryId, servings: 2 },
        })
      ).json,
    );
    expect(replay.id).toBe(entryId);

    // Half a serving halves every number.
    const half = logRecipeResponseSchema.parse(
      (
        await http(base, 'POST', `/recipes/${created.id}/log`, {
          token: author.token,
          body: { id: crypto.randomUUID(), servings: 0.5 },
        })
      ).json,
    );
    expect(half).toMatchObject({ totalCalories: 260, totalProtein: 21, totalCarbs: 24, totalFat: 8 });

    // Both meals are in the calorie log, and the replay did not add a third.
    const entries = (await http(base, 'GET', '/nutrition/entries', { token: author.token })).json as Array<{
      id: string;
    }>;
    expect(entries.filter((e) => e.id === entryId)).toHaveLength(1);
    expect(entries.map((e) => e.id)).toContain(half.id);
  });

  it('refuses to log a recipe with no estimated macros or a recipe the member cannot see', async () => {
    const author = await register(base, 'recipe-log-nomacros@example.com');
    const other = await register(base, 'recipe-log-other@example.com');
    const created = await createRecipe(author.token, draft({ macros: null }));

    const refused = await http(base, 'POST', `/recipes/${created.id}/log`, {
      token: author.token,
      body: { id: crypto.randomUUID(), servings: 1 },
    });
    expect(refused.status).toBe(409);

    // Someone else's draft is not loggable: it does not exist for them.
    const draftOnly = await createRecipe(author.token, draft());
    const invisible = await http(base, 'POST', `/recipes/${draftOnly.id}/log`, {
      token: other.token,
      body: { id: crypto.randomUUID(), servings: 1 },
    });
    expect(invisible.status).toBe(404);

    expect(
      (
        await http(base, 'POST', `/recipes/${crypto.randomUUID()}/log`, {
          token: author.token,
          body: { id: crypto.randomUUID(), servings: 1 },
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await http(base, 'POST', `/recipes/${created.id}/log`, {
          token: author.token,
          body: { id: crypto.randomUUID(), servings: 0 },
        })
      ).status,
    ).toBe(400);
  });

  it('answers 503 for photos when no object store is configured', async () => {
    const author = await register(bareBase, 'recipe-bare@example.com');
    const created = recipeDetailSchema.parse(
      (await http(bareBase, 'POST', '/recipes', { token: author.token, body: draft() })).json,
    );
    const upload = await http(bareBase, 'POST', `/recipes/${created.id}/photos`, {
      token: author.token,
      body: { imageBase64: PNG_BASE64, mimeType: 'image/png', stepOrder: null },
    });
    expect(upload.status).toBe(503);
    // The text of the recipe survives a failed photo upload.
    const still = recipeDetailSchema.parse(
      (await http(bareBase, 'GET', `/recipes/${created.id}`, { token: author.token })).json,
    );
    expect(still.title).toBe(created.title);
  });
});
