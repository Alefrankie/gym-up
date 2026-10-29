// tests/nest/nutrition.e2e.test.ts
//
// Nutrition over real HTTP: real use cases and SQLite repositories, an in-memory object store, and the scriptable
// in-memory AI adapter standing in for Gemini (the Gemini adapter has its own tests).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import * as schema from '@db/schema';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { InMemoryAIAnalysisAdapter } from '@/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter';
import { InMemoryPhotoStorage } from '@/lib/contexts/private-photos/infrastructure/in-memory-photo-storage';
import { createApp } from '../../src/nest/create-app';
import {
  analyzeMealResponseSchema,
  calorieGoalSchema,
  dailySummarySchema,
  nutritionEntrySchema,
  nutritionHistoryResponseSchema,
  sessionResponseSchema,
} from '@gym-up/contracts';

const fakeHasher: PasswordHasher = { hash: async (p) => `fake$${p}`, verify: async (p, h) => h === `fake$${p}` };

function freshDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  return drizzle(sqlite, { schema }) as unknown as Db;
}

const ai = new InMemoryAIAnalysisAdapter();
let app: INestApplication;
let base: string;
let bareApp: INestApplication;
let bareBase: string;
let storage: InMemoryPhotoStorage;

async function listen(a: INestApplication) {
  await a.listen(0, '127.0.0.1');
  return (await a.getUrl()).replace('[::1]', '127.0.0.1');
}

async function call(root: string, method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(root + path, {
    method,
    headers: { ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return res;
}

async function register(root: string, email: string) {
  const r = await call(root, 'POST', '/auth/register', { body: { email, password: 'longenough', displayName: 'Comida', routineType: 'hombre' } });
  return sessionResponseSchema.parse(await r.json());
}

const meal = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  totalCalories: 650,
  totalProtein: 40,
  totalCarbs: 70,
  totalFat: 20,
  foodItems: [{ name: 'Arroz con pollo', calories: 650, protein: 40, carbs: 70, fat: 20 }],
  userEdited: false,
  ...overrides,
});

// A small valid-looking JPEG, base64 encoded; padded so the JSON body is larger than body-parser's 100 kb default.
const jpegBase64 = (kb = 1) => {
  const bytes = new Uint8Array(kb * 1024);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return Buffer.from(bytes).toString('base64');
};

beforeAll(async () => {
  storage = new InMemoryPhotoStorage();
  app = (await createApp({ db: freshDb(), hasher: fakeHasher, photoStorage: storage, aiAnalysis: ai })).app;
  base = await listen(app);
  bareApp = (await createApp({ db: freshDb(), hasher: fakeHasher })).app;
  bareBase = await listen(bareApp);
});

afterAll(async () => {
  await app.close();
  await bareApp.close();
});

describe('nutrition', () => {
  it('requires authentication', async () => {
    expect((await call(base, 'GET', '/nutrition/entries')).status).toBe(401);
    expect((await call(base, 'POST', '/nutrition/analyze', { body: {} })).status).toBe(401);
  });

  it('answers 503 on /analyze when no AI key is configured, and still lets you log meals and set a goal', async () => {
    const s = await register(bareBase, 'noai@example.com');
    const r = await call(bareBase, 'POST', '/nutrition/analyze', { token: s.token, body: { imageBase64: jpegBase64(), mimeType: 'image/jpeg' } });
    expect(r.status).toBe(503);
    expect((await call(bareBase, 'POST', '/nutrition/entries', { token: s.token, body: meal() })).status).toBe(200);
    expect((await call(bareBase, 'PUT', '/nutrition/goal', { token: s.token, body: { dailyCalorieGoal: 2200 } })).status).toBe(200);
  });

  it('analyzes a photo and returns camelCase macros, accepting a body larger than 100 kb', async () => {
    ai.setNextResult({
      total_calories: 520,
      total_protein: 30,
      total_carbs: 55,
      total_fat: 18,
      food_items: [{ name: 'Pasta', estimated_calories: 520, estimated_protein: 30, estimated_carbs: 55, estimated_fat: 18 }],
    });
    const s = await register(base, 'analyze@example.com');
    const r = await call(base, 'POST', '/nutrition/analyze', { token: s.token, body: { imageBase64: jpegBase64(300), mimeType: 'image/jpeg' } });
    expect(r.status).toBe(200);
    expect(analyzeMealResponseSchema.parse(await r.json())).toMatchObject({ totalCalories: 520, foodItems: [{ name: 'Pasta', calories: 520 }] });
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]!.format).toBe('jpg');
  });

  it('rejects an oversized analysis photo (413) and an unsupported type (400 from the shared contract)', async () => {
    const s = await register(base, 'analyze-bad@example.com');
    const big = await call(base, 'POST', '/nutrition/analyze', { token: s.token, body: { imageBase64: jpegBase64(5 * 1024 + 8), mimeType: 'image/jpeg' } });
    expect(big.status).toBe(413);
    const gif = await call(base, 'POST', '/nutrition/analyze', { token: s.token, body: { imageBase64: jpegBase64(), mimeType: 'image/gif' } });
    expect(gif.status).toBe(400);
  });

  it('logs a meal with its photo, is idempotent by client id, lists it and serves the photo (owner only)', async () => {
    const a = await register(base, 'log-a@example.com');
    const b = await register(base, 'log-b@example.com');
    const body = meal({ imageBase64: jpegBase64(2), mimeType: 'image/jpeg' });
    const before = storage.size;

    const first = await call(base, 'POST', '/nutrition/entries', { token: a.token, body });
    expect(first.status).toBe(200);
    expect(nutritionEntrySchema.parse(await first.json())).toMatchObject({ id: body.id, totalCalories: 650, hasPhoto: true });
    expect((await call(base, 'POST', '/nutrition/entries', { token: a.token, body })).status).toBe(200);
    expect(storage.size).toBe(before + 1);

    const list = nutritionHistoryResponseSchema.parse(await (await call(base, 'GET', '/nutrition/entries', { token: a.token })).json());
    expect(list.filter((e) => e.id === body.id)).toHaveLength(1);

    const photo = await call(base, 'GET', `/nutrition/entries/${body.id}/photo`, { token: a.token });
    expect(photo.status).toBe(200);
    expect(photo.headers.get('content-type')).toBe('image/jpeg');
    expect((await call(base, 'GET', `/nutrition/entries/${body.id}/photo`, { token: b.token })).status).toBe(404);
    expect(nutritionHistoryResponseSchema.parse(await (await call(base, 'GET', '/nutrition/entries', { token: b.token })).json())).toEqual([]);
  });

  it('deletes an entry together with its photo', async () => {
    const s = await register(base, 'del@example.com');
    const body = meal({ imageBase64: jpegBase64(), mimeType: 'image/jpeg' });
    await call(base, 'POST', '/nutrition/entries', { token: s.token, body });
    const sizeWith = storage.size;
    expect((await call(base, 'DELETE', `/nutrition/entries/${body.id}`, { token: s.token })).status).toBe(204);
    expect(storage.size).toBe(sizeWith - 1);
    expect((await call(base, 'DELETE', `/nutrition/entries/${body.id}`, { token: s.token })).status).toBe(404);
  });

  it('sums today\'s calories against the goal', async () => {
    const s = await register(base, 'summary@example.com');
    expect(dailySummarySchema.parse(await (await call(base, 'GET', '/nutrition/summary', { token: s.token })).json())).toEqual({ consumed: 0, goal: null, remaining: null });
    await call(base, 'PUT', '/nutrition/goal', { token: s.token, body: { dailyCalorieGoal: 2000 } });
    await call(base, 'POST', '/nutrition/entries', { token: s.token, body: meal({ totalCalories: 700 }) });
    await call(base, 'POST', '/nutrition/entries', { token: s.token, body: meal({ totalCalories: 450 }) });
    const summary = dailySummarySchema.parse(await (await call(base, 'GET', '/nutrition/summary', { token: s.token })).json());
    expect(summary).toEqual({ consumed: 1150, goal: 2000, remaining: 850 });
  });

  it('validates the calorie goal and can clear it', async () => {
    const s = await register(base, 'goal@example.com');
    expect((await call(base, 'PUT', '/nutrition/goal', { token: s.token, body: { dailyCalorieGoal: 0 } })).status).toBe(400);
    expect((await call(base, 'PUT', '/nutrition/goal', { token: s.token, body: { dailyCalorieGoal: 20000 } })).status).toBe(400);
    expect((await call(base, 'PUT', '/nutrition/goal', { token: s.token, body: { dailyCalorieGoal: 1800 } })).status).toBe(200);
    expect(calorieGoalSchema.parse(await (await call(base, 'GET', '/nutrition/goal', { token: s.token })).json())).toEqual({ dailyCalorieGoal: 1800 });
    await call(base, 'PUT', '/nutrition/goal', { token: s.token, body: { dailyCalorieGoal: null } });
    expect(calorieGoalSchema.parse(await (await call(base, 'GET', '/nutrition/goal', { token: s.token })).json())).toEqual({ dailyCalorieGoal: null });
  });

  it('maps an unrecognized food error from the AI to 422', async () => {
    const { AIUnrecognizedFoodError } = await import('@/lib/contexts/nutrition/domain/errors');
    ai.setNextError(new AIUnrecognizedFoodError());
    const s = await register(base, 'unrecognized@example.com');
    const r = await call(base, 'POST', '/nutrition/analyze', { token: s.token, body: { imageBase64: jpegBase64(), mimeType: 'image/jpeg' } });
    expect(r.status).toBe(422);
  });
});
