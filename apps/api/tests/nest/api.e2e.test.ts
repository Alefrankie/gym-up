// tests/nest/api.e2e.test.ts
//
// End-to-end tests of the Nest API over real HTTP, with an in-memory SQLite database
// built from the real migrations and the real reference seed. The Worker entry point
// (src/worker.ts) only swaps the database and the hasher.

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
import { createApp } from '../../src/nest/create-app';
import {
  sessionResponseSchema,
  startWorkoutResponseSchema,
  workoutDetailSchema,
  workoutEntrySchema,
  workoutHistoryResponseSchema,
  workoutSchema,
  todayWorkoutResponseSchema,
  userSchema,
} from '@gym-up/contracts';

// Hashing is covered by its own test; a deterministic fake keeps this suite fast.
const fakeHasher: PasswordHasher = {
  hash: async (p) => `fake$${p}`,
  verify: async (p, h) => h === `fake$${p}`,
};

let app: INestApplication;
let base: string;
let db: Db;

async function http(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : undefined };
}

async function register(email: string) {
  const r = await http('POST', '/auth/register', {
    body: { email, password: 'longenough', displayName: 'Tester', routineType: 'hombre', weightUnit: 'kg' },
  });
  expect(r.status).toBe(201);
  return sessionResponseSchema.parse(r.json);
}

beforeAll(async () => {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  // The hand-written migrations hold several statements per file, which drizzle's migrator rejects;
  // exec() applies them the same way `wrangler d1 migrations apply` does.
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  }
  const raw = drizzle(sqlite, { schema });
  db = raw as unknown as Db;
  await seedReferenceData(db);

  const created = await createApp({ db, hasher: fakeHasher });
  app = created.app;
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app.close();
});

describe('health and CORS', () => {
  it('answers /health', async () => {
    const r = await http('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
  });

  it('allows the Tauri origin and rejects an unknown one', async () => {
    const ok = await http('OPTIONS', '/auth/login', {
      headers: { origin: 'http://tauri.localhost', 'access-control-request-method': 'POST' },
    });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://tauri.localhost');
    const bad = await http('OPTIONS', '/auth/login', {
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('auth', () => {
  it('registers, returns a session that matches the contract, and /auth/me works', async () => {
    const session = await register('auth1@example.com');
    const me = await http('GET', '/auth/me', { token: session.token });
    expect(me.status).toBe(200);
    expect(userSchema.parse(me.json).email).toBe('auth1@example.com');
  });

  it('rejects a duplicate email with 409', async () => {
    await register('dup@example.com');
    const r = await http('POST', '/auth/register', {
      body: { email: 'dup@example.com', password: 'longenough', displayName: 'X', routineType: 'mujer' },
    });
    expect(r.status).toBe(409);
  });

  it('logs in with the right password and rejects the wrong one with 401', async () => {
    await register('login@example.com');
    const ok = await http('POST', '/auth/login', { body: { email: 'login@example.com', password: 'longenough' } });
    expect(ok.status).toBe(200);
    sessionResponseSchema.parse(ok.json);
    const bad = await http('POST', '/auth/login', { body: { email: 'login@example.com', password: 'wrong-password' } });
    expect(bad.status).toBe(401);
  });

  it('validates bodies with the shared contract (400)', async () => {
    const r = await http('POST', '/auth/register', { body: { email: 'not-an-email', password: 'x' } });
    expect(r.status).toBe(400);
    expect(r.json.statusCode).toBe(400);
  });

  it('rejects missing and invalid tokens with 401, and logout revokes the session', async () => {
    expect((await http('GET', '/auth/me')).status).toBe(401);
    expect((await http('GET', '/auth/me', { token: 'nope' })).status).toBe(401);
    const s = await register('logout@example.com');
    expect((await http('POST', '/auth/logout', { token: s.token })).status).toBe(204);
    expect((await http('GET', '/auth/me', { token: s.token })).status).toBe(401);
  });
});

describe('workouts', () => {
  async function firstRoutineDayId(): Promise<string> {
    const day = await db.select().from(schema.routineDays).limit(1);
    return day[0]!.id;
  }

  it('shows today and rejects unauthenticated access', async () => {
    expect((await http('GET', '/workouts/today')).status).toBe(401);
    const s = await register('today@example.com');
    const r = await http('GET', '/workouts/today', { token: s.token });
    expect(r.status).toBe(200);
    todayWorkoutResponseSchema.parse(r.json);
  });

  it('runs the full flow: start, log sets idempotently, detail, complete, history', async () => {
    const s = await register('flow@example.com');
    const dayId = await firstRoutineDayId();
    const workoutId = crypto.randomUUID();

    const start = await http('POST', '/workouts', { token: s.token, body: { id: workoutId, routineDayId: dayId } });
    expect(start.status).toBe(200);
    const started = startWorkoutResponseSchema.parse(start.json);
    expect(started.kind).toBe('started');
    expect(started.workout.id).toBe(workoutId);

    // Replaying the same client id never creates a second workout (ADR-025).
    const replay = await http('POST', '/workouts', { token: s.token, body: { id: workoutId, routineDayId: dayId } });
    expect(startWorkoutResponseSchema.parse(replay.json)).toMatchObject({ kind: 'resumed', workout: { id: workoutId } });

    const exercise = (await db.select().from(schema.exercises).limit(1))[0]!;
    const setId = crypto.randomUUID();
    const setBody = { id: setId, exerciseId: exercise.id, setNumber: 1, reps: 10, weight: 60, weightUnit: 'kg', completed: true, notes: null };
    const first = await http('PUT', `/workouts/${workoutId}/sets`, { token: s.token, body: setBody });
    expect(first.status).toBe(200);
    expect(workoutEntrySchema.parse(first.json).id).toBe(setId);

    // Same set again with edited reps: still one entry.
    const second = await http('PUT', `/workouts/${workoutId}/sets`, { token: s.token, body: { ...setBody, reps: 12 } });
    expect(workoutEntrySchema.parse(second.json).reps).toBe(12);

    // Pounds are converted to kg on the way in (ADR-006).
    const lbs = await http('PUT', `/workouts/${workoutId}/sets`, {
      token: s.token,
      body: { ...setBody, id: crypto.randomUUID(), setNumber: 2, weight: 100, weightUnit: 'lbs' },
    });
    expect(workoutEntrySchema.parse(lbs.json).weight).toBeCloseTo(45.36, 1);

    const detail = workoutDetailSchema.parse((await http('GET', `/workouts/${workoutId}`, { token: s.token })).json);
    expect(detail.entries).toHaveLength(2);
    expect(detail.entries[0]!.exerciseName).toBe(exercise.name);

    const done = await http('POST', `/workouts/${workoutId}/complete`, { token: s.token });
    expect(done.status).toBe(200);
    expect(workoutSchema.parse(done.json).status).toBe('completed');

    const history = workoutHistoryResponseSchema.parse((await http('GET', '/workouts', { token: s.token })).json);
    expect(history.items.map((i) => i.id)).toContain(workoutId);
  });

  it('maps domain errors to HTTP: 400 no entries, 403 other user, 404 unknown, 400 bad set', async () => {
    const owner = await register('owner@example.com');
    const other = await register('other@example.com');
    const dayId = await firstRoutineDayId();
    const workoutId = crypto.randomUUID();
    await http('POST', '/workouts', { token: owner.token, body: { id: workoutId, routineDayId: dayId } });

    expect((await http('POST', `/workouts/${workoutId}/complete`, { token: owner.token })).status).toBe(400);
    expect((await http('POST', `/workouts/${workoutId}/complete`, { token: other.token })).status).toBe(403);
    expect((await http('GET', `/workouts/${workoutId}`, { token: other.token })).status).toBe(403);
    expect((await http('POST', `/workouts/${crypto.randomUUID()}/complete`, { token: owner.token })).status).toBe(404);

    const exercise = (await db.select().from(schema.exercises).limit(1))[0]!;
    const bad = await http('PUT', `/workouts/${workoutId}/sets`, {
      token: owner.token,
      body: { id: crypto.randomUUID(), exerciseId: exercise.id, setNumber: 1, reps: 0, weight: 10, weightUnit: 'kg' },
    });
    expect(bad.status).toBe(400);
  });

  it('rejects a start with an invalid routine day (400)', async () => {
    const s = await register('badday@example.com');
    const r = await http('POST', '/workouts', { token: s.token, body: { id: crypto.randomUUID(), routineDayId: 'does-not-exist' } });
    expect(r.status).toBe(400);
  });
});
