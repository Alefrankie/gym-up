// tests/nest/progress-family.e2e.test.ts
//
// End-to-end tests (real HTTP, in-memory SQLite from the real migrations) for the progress and family modules.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as schema from '@db/schema';
import { seedReferenceData } from '../../db/seed';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { SqliteProgramRepository } from '../../src/lib/contexts/routines/infrastructure/sqlite/sqlite-program.repository';
import { createApp } from '../../src/nest/create-app';
import { InMemoryPhotoStorage } from '@/lib/contexts/private-photos/infrastructure/in-memory-photo-storage';
import {
  calendarResponseSchema,
  exerciseHistoryResponseSchema,
  exerciseListResponseSchema,
  communityMemberListSchema,
  communityPageSchema,
  communityProfileSchema,
  communityWorkoutSchema,
  likeStateSchema,
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
    expect(streakSchema.parse((await http('GET', '/progress/streak', { token: s.token })).json)).toEqual({ current: 0, total: 0, canFreeze: false, frozenDays: [] });
    expect(exerciseListResponseSchema.parse((await http('GET', '/progress/exercises', { token: s.token })).json)).toEqual([]);
  });

  it('refuses a streak freeze when there is no streak to save', async () => {
    expect((await http('POST', '/progress/streak/freeze')).status).toBe(401);
    const s = await register('freeze-progress@example.com', 'Freeze');
    expect((await http('POST', '/progress/streak/freeze', { token: s.token })).status).toBe(409);
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

describe('community', () => {
  it('requires a session for every community route', async () => {
    for (const path of ['/community/feed', '/community/members', '/community/members/x', '/community/workouts/x', '/community/workouts/x/photo']) {
      expect((await http('GET', path)).status).toBe(401);
    }
  });

  it('lets members who never shared a group see each other, without private fields', async () => {
    const a = await userWithOneWorkout('community-a@example.com', 'Ana');
    const b = await register('community-b@example.com', 'Beto');
    const [w] = await db.select().from(schema.workouts).where(eq(schema.workouts.userId, a.session.user.id));
    await db.update(schema.workoutEntries).set({ notes: 'secret note', bodyWeightKgAtSet: 81.5 }).where(eq(schema.workoutEntries.workoutId, w!.id));
    await db.insert(schema.supplements).values([
      { userId: a.session.user.id, name: 'Creatina' },
      { userId: a.session.user.id, name: 'Vieja', archived: true },
    ]);

    const feedRes = await http('GET', '/community/feed', { token: b.token });
    const feed = communityPageSchema.parse(feedRes.json);
    const card = feed.items.find((x) => x.author.id === a.session.user.id)!;
    expect(card).toMatchObject({ totalSets: 2, volumeKg: 10 * 60 + 8 * 70, likeCount: 0, viewerHasLiked: false, isMine: false, hasPhoto: false });
    const raw = JSON.stringify(feedRes.json);
    for (const leak of ['secret note', '81.5', 'community-a@example.com', 'bodyWeight', 'notes']) expect(raw).not.toContain(leak);

    // The author's own workout is not in their feed, but is in their profile history.
    const own = communityPageSchema.parse((await http('GET', '/community/feed', { token: a.session.token })).json);
    expect(own.items.some((x) => x.author.id === a.session.user.id)).toBe(false);
    const history = communityPageSchema.parse((await http('GET', `/community/members/${a.session.user.id}/workouts`, { token: b.token })).json);
    expect(history.items).toHaveLength(1);

    const profile = communityProfileSchema.parse((await http('GET', `/community/members/${a.session.user.id}`, { token: b.token })).json);
    expect(profile.supplements).toEqual(['Creatina']);
    expect(profile.isMe).toBe(false);
    expect(profile.thisWeek).toMatchObject({ sessions: 1, sets: 2, volumeKg: 1160 });
    expect(JSON.stringify(profile)).not.toContain('community-a@example.com');
    const members = communityMemberListSchema.parse((await http('GET', '/community/members', { token: b.token })).json);
    expect(members.items.map((m) => m.displayName)).toContain('Ana');
  });

  it('never shows workouts that are still in progress', async () => {
    const s = await register('community-live@example.com', 'Live');
    const day = (await db.select().from(schema.routineDays).limit(1))[0]!;
    const id = crypto.randomUUID();
    await http('POST', '/workouts', { token: s.token, body: { id, routineDayId: day.id } });
    expect((await http('GET', `/community/workouts/${id}`, { token: s.token })).status).toBe(404);
    const viewer = await register('community-live-viewer@example.com', 'Viewer');
    const feed = communityPageSchema.parse((await http('GET', '/community/feed', { token: viewer.token })).json);
    expect(feed.items.some((x) => x.id === id)).toBe(false);
  });

  it('keeps likes idempotent and refuses liking your own workout', async () => {
    const a = await userWithOneWorkout('like-a@example.com', 'Lia');
    const b = await register('like-b@example.com', 'Bo');
    const c = await register('like-c@example.com', 'Cy');
    const [w] = await db.select().from(schema.workouts).where(eq(schema.workouts.userId, a.session.user.id));
    const path = `/community/workouts/${w!.id}/like`;
    expect(likeStateSchema.parse((await http('PUT', path, { token: b.token })).json)).toEqual({ likeCount: 1, viewerHasLiked: true });
    expect(likeStateSchema.parse((await http('PUT', path, { token: b.token })).json)).toEqual({ likeCount: 1, viewerHasLiked: true });
    expect(likeStateSchema.parse((await http('PUT', path, { token: c.token })).json).likeCount).toBe(2);
    expect(likeStateSchema.parse((await http('DELETE', path, { token: b.token })).json)).toEqual({ likeCount: 1, viewerHasLiked: false });
    expect(likeStateSchema.parse((await http('DELETE', path, { token: b.token })).json).likeCount).toBe(1);
    expect((await http('PUT', path, { token: a.session.token })).status).toBe(409);
    expect((await http('PUT', '/community/workouts/nope/like', { token: b.token })).status).toBe(404);
  });

  it('hides soft-deleted members everywhere and blocks their sign-in', async () => {
    const gone = await userWithOneWorkout('soft-gone@example.com', 'Borrado');
    const viewer = await register('soft-viewer@example.com', 'Mira');
    const [w] = await db.select().from(schema.workouts).where(eq(schema.workouts.userId, gone.session.user.id));
    await db.update(schema.profiles).set({ deletedAt: new Date() }).where(eq(schema.profiles.id, gone.session.user.id));

    const feed = communityPageSchema.parse((await http('GET', '/community/feed', { token: viewer.token })).json);
    expect(feed.items.some((x) => x.author.id === gone.session.user.id)).toBe(false);
    const members = communityMemberListSchema.parse((await http('GET', '/community/members', { token: viewer.token })).json);
    expect(members.items.some((m) => m.id === gone.session.user.id)).toBe(false);
    expect((await http('GET', `/community/members/${gone.session.user.id}`, { token: viewer.token })).status).toBe(404);
    expect((await http('GET', `/community/workouts/${w!.id}`, { token: viewer.token })).status).toBe(404);
    expect((await http('GET', '/community/feed', { token: gone.session.token })).status).toBe(401);
    expect((await http('POST', '/auth/login', { body: { email: 'soft-gone@example.com', password: 'longenough' } })).status).toBe(401);
  });

  it('answers 410 for the retired group routes', async () => {
    const s = await register('groups-gone@example.com', 'Gone');
    expect((await http('GET', '/groups', { token: s.token })).status).toBe(410);
    expect((await http('POST', '/groups/join', { token: s.token, body: { code: 'ABCDEF' } })).status).toBe(410);
  });

  it('answers 503 for shared photos when no object store is configured', async () => {
    const s = await register('photo-none@example.com', 'NoStore');
    expect((await http('GET', '/community/workouts/x/photo', { token: s.token })).status).toBe(503);
  });
});

describe('community shared photos', () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3, 0xff, 0xd9]);

  it('lets only the author share a photo and any member read it', async () => {
    const storage = new InMemoryPhotoStorage();
    const photoApp = (await createApp({ db, hasher: fakeHasher, photoStorage: storage })).app;
    await photoApp.listen(0, '127.0.0.1');
    const root = (await photoApp.getUrl()).replace('[::1]', '127.0.0.1');
    try {
      const a = await userWithOneWorkout('photo-a@example.com', 'Pia');
      const b = await register('photo-b@example.com', 'Pol');
      const [w] = await db.select().from(schema.workouts).where(eq(schema.workouts.userId, a.session.user.id));
      const url = `${root}/community/workouts/${w!.id}/photo`;
      const auth = (token: string) => ({ authorization: `Bearer ${token}` });
      const put = (token: string, bytes: Uint8Array, type = 'image/jpeg') =>
        fetch(url, { method: 'PUT', headers: { ...auth(token), 'content-type': type }, body: bytes as unknown as BodyInit });

      expect((await put(b.token, JPEG)).status).toBe(403);
      expect((await put(a.session.token, new TextEncoder().encode('not an image at all'))).status).toBe(415);
      expect((await put(a.session.token, JPEG)).status).toBe(204);
      const firstKey = (await db.select().from(schema.sharedWorkoutPhotos))[0]!.storageKey;
      expect((await put(a.session.token, JPEG)).status).toBe(204);
      expect(await storage.get(firstKey)).toBeNull(); // replacing removes the old object

      const got = await fetch(url, { headers: auth(b.token) });
      expect(got.status).toBe(200);
      expect(new Uint8Array(await got.arrayBuffer())).toEqual(JPEG);
      expect((await fetch(url)).status).toBe(401);
      const detail = await (await fetch(`${root}/community/workouts/${w!.id}`, { headers: auth(b.token) })).json();
      expect(communityWorkoutSchema.parse(detail).hasPhoto).toBe(true);

      expect((await fetch(url, { method: 'DELETE', headers: auth(a.session.token) })).status).toBe(204);
      expect((await fetch(url, { headers: auth(b.token) })).status).toBe(404);
      expect(await db.select().from(schema.workouts).where(eq(schema.workouts.id, w!.id))).toHaveLength(1);
    } finally {
      await photoApp.close();
    }
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
