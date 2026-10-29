// tests/nest/progress-family.e2e.test.ts
//
// End-to-end tests (real HTTP, in-memory SQLite from the real migrations) for the progress and family modules.

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
import { SqliteProgramRepository } from '../../src/lib/contexts/routines/infrastructure/sqlite/sqlite-program.repository';
import { createApp } from '../../src/nest/create-app';
import {
  calendarResponseSchema,
  exerciseHistoryResponseSchema,
  exerciseListResponseSchema,
  groupDetailSchema,
  groupListResponseSchema,
  groupSummarySchema,
  memberProfileSchema,
  sessionResponseSchema,
  streakSchema,
} from '@gym-up/contracts';

const fakeHasher: PasswordHasher = { hash: async (p) => `fake$${p}`, verify: async (p, h) => h === `fake$${p}` };

let app: INestApplication;
let base: string;
let db: Db;

async function http(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(base + path, {
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

async function register(email: string, displayName: string) {
  const r = await http('POST', '/auth/register', {
    body: { email, password: 'longenough', displayName, routineType: 'hombre', weightUnit: 'kg' },
  });
  return sessionResponseSchema.parse(r.json);
}

/** Registers a user and finishes one workout with two sets: 10 x 60 kg and 8 x 70 kg. */
async function userWithOneWorkout(email: string, displayName: string) {
  const session = await register(email, displayName);
  const day = (await db.select().from(schema.routineDays).limit(1))[0]!;
  const exercise = (await db.select().from(schema.exercises).limit(1))[0]!;
  const workoutId = crypto.randomUUID();
  await http('POST', '/workouts', { token: session.token, body: { id: workoutId, routineDayId: day.id } });
  for (const [n, reps, weight] of [[1, 10, 60], [2, 8, 70]] as const) {
    await http('PUT', `/workouts/${workoutId}/sets`, {
      token: session.token,
      body: { id: crypto.randomUUID(), exerciseId: exercise.id, setNumber: n, reps, weight, weightUnit: 'kg' },
    });
  }
  const done = await http('POST', `/workouts/${workoutId}/complete`, { token: session.token });
  expect(done.status).toBe(200);
  return { session, exercise };
}

beforeAll(async () => {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  db = drizzle(sqlite, { schema }) as unknown as Db;
  await seedReferenceData(db);
  app = (await createApp({ db, hasher: fakeHasher })).app;
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app.close();
});

describe('progress', () => {
  it('requires authentication', async () => {
    for (const path of ['/progress/streak', '/progress/calendar', '/progress/exercises']) {
      expect((await http('GET', path)).status).toBe(401);
    }
  });

  it('is empty for a user with no workouts', async () => {
    const s = await register('empty-progress@example.com', 'Empty');
    expect(streakSchema.parse((await http('GET', '/progress/streak', { token: s.token })).json)).toEqual({ current: 0, total: 0 });
    expect(exerciseListResponseSchema.parse((await http('GET', '/progress/exercises', { token: s.token })).json)).toEqual([]);
  });

  it('reports streak, logged exercises, history and calendar after a finished workout', async () => {
    const { session, exercise } = await userWithOneWorkout('progress@example.com', 'Progress');
    const token = session.token;

    const streak = streakSchema.parse((await http('GET', '/progress/streak', { token })).json);
    expect(streak.total).toBe(1);
    expect(streak.current).toBe(1);

    const exercises = exerciseListResponseSchema.parse((await http('GET', '/progress/exercises', { token })).json);
    expect(exercises.map((e) => e.id)).toContain(exercise.id);

    const history = exerciseHistoryResponseSchema.parse(
      (await http('GET', `/progress/exercises/${exercise.id}/history?range=all`, { token })).json,
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ weight: 70, volume: 10 * 60 + 8 * 70 });

    // The default range is 30 days, and an unknown range is rejected by the shared contract.
    expect((await http('GET', `/progress/exercises/${exercise.id}/history`, { token })).status).toBe(200);
    expect((await http('GET', `/progress/exercises/${exercise.id}/history?range=1y`, { token })).status).toBe(400);

    const calendar = calendarResponseSchema.parse((await http('GET', '/progress/calendar', { token })).json);
    expect(calendar).toHaveLength(28);
    expect(calendar.some((d) => d.hasWorkout)).toBe(true);
  });

  it('only returns the caller\'s own history', async () => {
    const a = await userWithOneWorkout('own-a@example.com', 'A');
    const b = await register('own-b@example.com', 'B');
    const history = exerciseHistoryResponseSchema.parse(
      (await http('GET', `/progress/exercises/${a.exercise.id}/history?range=all`, { token: b.token })).json,
    );
    expect(history).toEqual([]);
  });
});

describe('groups', () => {
  const create = async (token: string, name: string) => {
    const r = await http('POST', '/groups', { token, body: { name } });
    expect(r.status).toBe(200);
    return groupSummarySchema.parse(r.json);
  };

  it('requires authentication', async () => {
    expect((await http('GET', '/groups')).status).toBe(401);
    expect((await http('GET', '/family')).status).toBe(404);
  });

  it('creates a group with an invite code and lets others join with it', async () => {
    const a = await userWithOneWorkout('grp-a@example.com', 'Ana');
    const b = await register('grp-b@example.com', 'Beto');
    const group = await create(a.session.token, 'Los del gym');
    expect(group).toMatchObject({ name: 'Los del gym', memberCount: 1, isOwner: true });
    expect(group.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const joined = groupSummarySchema.parse(
      (await http('POST', '/groups/join', { token: b.token, body: { code: group.code.toLowerCase() } })).json,
    );
    expect(joined).toMatchObject({ id: group.id, memberCount: 2, isOwner: false });
    // joining twice is harmless
    expect(groupSummarySchema.parse((await http('POST', '/groups/join', { token: b.token, body: { code: group.code } })).json).memberCount).toBe(2);

    const detail = groupDetailSchema.parse((await http('GET', `/groups/${group.id}`, { token: b.token })).json);
    expect(detail.members.find((m) => m.id === a.session.user.id)).toMatchObject({ displayName: 'Ana', totalWorkouts: 1 });
    expect(detail.members.find((m) => m.id === b.user.id)).toMatchObject({ displayName: 'Beto', totalWorkouts: 0, lastWorkout: null });

    const member = memberProfileSchema.parse((await http('GET', `/groups/members/${a.session.user.id}`, { token: b.token })).json);
    expect(member.workouts).toHaveLength(1);
    expect(groupListResponseSchema.parse((await http('GET', '/groups', { token: b.token })).json).items).toHaveLength(1);
  });

  it('hides groups and members from people outside them', async () => {
    const a = await userWithOneWorkout('grp-c@example.com', 'Carla');
    const outsider = await register('grp-d@example.com', 'Dani');
    const group = await create(a.session.token, 'Privado');
    expect((await http('GET', `/groups/${group.id}`, { token: outsider.token })).status).toBe(404);
    expect((await http('GET', `/groups/members/${a.session.user.id}`, { token: outsider.token })).status).toBe(404);
    expect((await http('POST', '/groups/join', { token: outsider.token, body: { code: 'ZZZZZZ' } })).status).toBe(404);
    expect(groupListResponseSchema.parse((await http('GET', '/groups', { token: outsider.token })).json).items).toEqual([]);
  });

  it('lets a member leave, and never exposes email or password hash', async () => {
    const a = await register('grp-e@example.com', 'Eva');
    const b = await register('grp-f@example.com', 'Fer');
    const group = await create(a.token, 'Salida');
    await http('POST', '/groups/join', { token: b.token, body: { code: group.code } });
    const raw = JSON.stringify((await http('GET', `/groups/${group.id}`, { token: a.token })).json);
    expect(raw).not.toContain('@example.com');
    expect(raw).not.toContain('fake$');
    expect((await http('DELETE', `/groups/${group.id}/members/me`, { token: b.token })).status).toBe(204);
    expect((await http('GET', `/groups/${group.id}`, { token: b.token })).status).toBe(404);
    expect((await http('DELETE', `/groups/${group.id}/members/me`, { token: b.token })).status).toBe(404);
  });

  it('replays an offline create by id without a second group', async () => {
    const a = await register('grp-g@example.com', 'Gus');
    const id = crypto.randomUUID();
    const first = groupSummarySchema.parse((await http('POST', '/groups', { token: a.token, body: { id, name: 'Una vez' } })).json);
    const again = groupSummarySchema.parse((await http('POST', '/groups', { token: a.token, body: { id, name: 'Una vez' } })).json);
    expect(again.code).toBe(first.code);
    expect(groupListResponseSchema.parse((await http('GET', '/groups', { token: a.token })).json).items).toHaveLength(1);
  });
});

describe('last session load', () => {
  it('reports the best set of the last earlier session per exercise', async () => {
    const { session, exercise } = await userWithOneWorkout('last-a@example.com', 'Lola');
    const repo = new SqliteProgramRepository(db);
    // finished today: not "last session" yet
    expect((await repo.lastPerformance(session.user.id, [exercise.id], new Date(new Date().setHours(0, 0, 0, 0)))).size).toBe(0);
    await db.update(schema.workouts).set({ workoutDate: new Date(Date.now() - 7 * 86_400_000) });
    const last = (await repo.lastPerformance(session.user.id, [exercise.id], new Date())).get(exercise.id);
    expect(last).toMatchObject({ weight: 70, reps: 8 });
  });
});
