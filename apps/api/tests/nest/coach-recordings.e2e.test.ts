// The voice studio for several people, over real HTTP with the real migrations: who gets in, takes, likes, comments,
// the admin's active pick, and the recordings the app plays (only the active takes).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import * as schema from '@db/schema';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { createApp } from '../../src/nest/create-app';
import {
  STUDIO_DAILY_WRITES,
  coachRecordingListSchema,
  sessionResponseSchema,
  studioAccessSchema,
  studioOverviewSchema,
  studioUserListSchema,
  userSchema,
} from '@gym-up/contracts';

const fakeHasher: PasswordHasher = { hash: async (p) => `fake$${p}`, verify: async (p, h) => h === `fake$${p}` };
let app: INestApplication;
let sqlite: Database.Database;
let base: string;
let admin: { token: string; id: string };
let ana: { token: string; id: string };
let luis: { token: string; id: string };

const LINE = 'a'.repeat(32);
const OTHER_LINE = 'b'.repeat(32);
const META = { tone: 'gymrat', locale: 'es', event: 'restEnd', form: 'm', text: '¡Se acabó el descanso, marico!' };
const adminAudio = new Uint8Array([1, 1, 1, 1]);
const anaAudio = new Uint8Array([2, 2, 2]);

async function register(email: string, displayName: string) {
  const r = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'longenough', displayName, routineType: 'hombre', weightUnit: 'kg' }),
  });
  const s = sessionResponseSchema.parse(await r.json());
  return { token: s.token, id: s.user.id };
}

function call(who: { token: string } | null, method: string, path: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: { ...(who ? { authorization: `Bearer ${who.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const take = (who: { token: string }, bytes: Uint8Array, line = LINE, meta: Record<string, string> = META, type = 'audio/webm;codecs=opus') =>
  fetch(`${base}/studio/lines/${line}/take?${new URLSearchParams(meta)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${who.token}`, 'content-type': type },
    body: bytes as Uint8Array<ArrayBuffer>,
  });

const overview = async (who: { token: string }) => studioOverviewSchema.parse(await (await call(who, 'GET', '/studio/overview')).json());
const manifest = async (who: { token: string }) => coachRecordingListSchema.parse(await (await call(who, 'GET', '/coach/recordings')).json()).items;
const playLine = async (who: { token: string }, line = LINE) => {
  const r = await call(who, 'GET', `/coach/recordings/${line}`);
  return r.status === 200 ? new Uint8Array(await r.arrayBuffer()) : r.status;
};

beforeAll(async () => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  const db = drizzle(sqlite, { schema }) as unknown as Db;
  ({ app } = await createApp({ db, hasher: fakeHasher }));
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  admin = await register('Alefrank.M@gmail.com', 'Ale');
  ana = await register('ana@example.com', 'Ana Pérez');
  luis = await register('luis@example.com', 'Luis');
});

afterAll(async () => {
  await app.close();
});

describe('voice studio: access', () => {
  it('lets in only the admin until the admin grants someone', async () => {
    expect(userSchema.parse(await (await call(ana, 'GET', '/auth/me')).json()).isAdmin).toBe(false);
    expect(studioAccessSchema.parse(await (await call(admin, 'GET', '/studio/access')).json())).toEqual({ allowed: true, admin: true });
    expect(studioAccessSchema.parse(await (await call(ana, 'GET', '/studio/access')).json())).toEqual({ allowed: false, admin: false });
    expect((await call(ana, 'GET', '/studio/overview')).status).toBe(403);
    expect((await take(ana, anaAudio)).status).toBe(403);
    expect((await call(null, 'GET', '/studio/access')).status).toBe(401);
  });

  it('lets only the admin search users and grant or revoke access', async () => {
    expect((await call(ana, 'GET', '/studio/users?q=ana')).status).toBe(403);
    expect((await call(ana, 'PUT', `/studio/members/${ana.id}`)).status).toBe(403);
    const found = studioUserListSchema.parse(await (await call(admin, 'GET', '/studio/users?q=PÉREZ'.toLowerCase())).json()).items;
    expect(found.map((u) => u.email)).toEqual(['ana@example.com']);
    const byEmail = studioUserListSchema.parse(await (await call(admin, 'GET', '/studio/users?q=example.com')).json()).items;
    expect(byEmail.map((u) => u.displayName).sort()).toEqual(['Ana Pérez', 'Luis']);

    expect((await call(admin, 'PUT', `/studio/members/${ana.id}`)).status).toBe(204);
    expect((await call(admin, 'PUT', `/studio/members/${luis.id}`)).status).toBe(204);
    expect((await call(admin, 'PUT', `/studio/members/nobody`)).status).toBe(404);
    const members = (await (await call(admin, 'GET', '/studio/members')).json()) as { items: { email: string }[] };
    expect(members.items.map((m) => m.email).sort()).toEqual(['ana@example.com', 'luis@example.com']);
    expect(studioAccessSchema.parse(await (await call(ana, 'GET', '/studio/access')).json())).toEqual({ allowed: true, admin: false });
  });
});

describe('voice studio: takes and the active pick', () => {
  it('keeps one take per person per line, with author and date; the admin take plays by default', async () => {
    expect((await take(ana, new Uint8Array([9]))).status).toBe(200);
    // Ana redoes her take: still one take, new audio.
    const redo = await take(ana, anaAudio);
    expect(redo.status).toBe(200);
    expect((await take(admin, adminAudio)).status).toBe(200);

    const o = await overview(luis);
    const takes = o.takes.filter((t) => t.lineId === LINE);
    expect(takes.map((t) => t.authorName).sort()).toEqual(['Ale', 'Ana Pérez']);
    expect(takes.find((t) => t.authorName === 'Ana Pérez')).toMatchObject({ bytes: 3, active: false, tone: 'gymrat', form: 'm' });
    expect(takes.find((t) => t.authorName === 'Ale')?.active).toBe(true);
    expect(takes.every((t) => t.createdAt > 0 && t.updatedAt >= t.createdAt)).toBe(true);

    // The app only gets the active take.
    expect((await manifest(luis)).map((r) => r.id)).toEqual([LINE]);
    expect(await playLine(luis)).toEqual(adminAudio);
  });

  it('lets members play every take', async () => {
    const anaTake = (await overview(luis)).takes.find((t) => t.authorName === 'Ana Pérez')!;
    const r = await call(luis, 'GET', `/studio/takes/${anaTake.id}/audio`);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(anaAudio);
    expect((await call(admin, 'DELETE', `/studio/members/${luis.id}`)).status).toBe(204);
    expect((await call(luis, 'GET', `/studio/takes/${anaTake.id}/audio`)).status).toBe(403);
    expect((await call(admin, 'PUT', `/studio/members/${luis.id}`)).status).toBe(204);
  });

  it('lets only the admin choose the active take, of that line only', async () => {
    const anaTake = (await overview(admin)).takes.find((t) => t.authorName === 'Ana Pérez')!;
    expect((await call(ana, 'PUT', `/studio/lines/${LINE}/active`, { takeId: anaTake.id })).status).toBe(403);
    expect((await call(admin, 'PUT', `/studio/lines/${OTHER_LINE}/active`, { takeId: anaTake.id })).status).toBe(400);
    const before = (await manifest(luis))[0]!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    expect((await call(admin, 'PUT', `/studio/lines/${LINE}/active`, { takeId: anaTake.id })).status).toBe(204);
    expect(await playLine(luis)).toEqual(anaAudio);
    expect((await manifest(luis))[0]!.updatedAt).toBeGreaterThan(before);
    // The admin redoing a take does not steal the pick back.
    expect((await take(admin, new Uint8Array([7, 7]))).status).toBe(200);
    expect(await playLine(luis)).toEqual(anaAudio);
  });

  it('lets people delete only their own takes; deleting the active one leaves the line without a recording', async () => {
    const o = await overview(admin);
    const adminTake = o.takes.find((t) => t.authorName === 'Ale')!;
    const anaTake = o.takes.find((t) => t.authorName === 'Ana Pérez')!;
    expect((await call(ana, 'DELETE', `/studio/takes/${adminTake.id}`)).status).toBe(403);
    expect((await call(ana, 'DELETE', `/studio/takes/${anaTake.id}`)).status).toBe(204);
    expect(await playLine(luis)).toBe(404);
    expect(await manifest(luis)).toEqual([]);
    // The admin deletes anyone's take.
    await take(luis, new Uint8Array([5]), OTHER_LINE);
    const luisTake = (await overview(admin)).takes.find((t) => t.authorName === 'Luis')!;
    expect((await call(admin, 'DELETE', `/studio/takes/${luisTake.id}`)).status).toBe(204);
  });
});

describe('voice studio: likes and comments', () => {
  it('counts one like per person and take', async () => {
    const adminTake = (await overview(admin)).takes.find((t) => t.authorName === 'Ale')!;
    expect((await call(ana, 'PUT', `/studio/takes/${adminTake.id}/vote`)).status).toBe(204);
    expect((await call(ana, 'PUT', `/studio/takes/${adminTake.id}/vote`)).status).toBe(204);
    expect((await call(luis, 'PUT', `/studio/takes/${adminTake.id}/vote`)).status).toBe(204);
    let t = (await overview(ana)).takes.find((x) => x.id === adminTake.id)!;
    expect(t).toMatchObject({ votes: 2, votedByMe: true });
    expect((await call(ana, 'DELETE', `/studio/takes/${adminTake.id}/vote`)).status).toBe(204);
    t = (await overview(ana)).takes.find((x) => x.id === adminTake.id)!;
    expect(t).toMatchObject({ votes: 1, votedByMe: false });
  });

  it('lets people delete their own comments and the admin any comment', async () => {
    const adminTake = (await overview(admin)).takes.find((t) => t.authorName === 'Ale')!;
    const c1 = (await (await call(ana, 'POST', `/studio/lines/${LINE}/comments`, { text: 'Más rabia, pana', takeId: adminTake.id })).json()) as { id: string; authorName: string };
    expect(c1.authorName).toBe('Ana Pérez');
    const c2 = (await (await call(luis, 'POST', `/studio/lines/${LINE}/comments`, { text: 'Me gusta' })).json()) as { id: string };
    expect((await call(luis, 'POST', `/studio/lines/${LINE}/comments`, { text: '' })).status).toBe(400);
    expect((await call(luis, 'POST', `/studio/lines/${LINE}/comments`, { text: 'x', takeId: 'nope' })).status).toBe(400);
    expect((await overview(luis)).comments.map((c) => c.text)).toEqual(['Más rabia, pana', 'Me gusta']);

    expect((await call(luis, 'DELETE', `/studio/comments/${c1.id}`)).status).toBe(403);
    expect((await call(luis, 'DELETE', `/studio/comments/${c2.id}`)).status).toBe(204);
    expect((await call(admin, 'DELETE', `/studio/comments/${c1.id}`)).status).toBe(204);
    expect((await overview(luis)).comments).toEqual([]);
  });
});

describe('voice studio: free-tier guards and validation', () => {
  it('stops a person at the daily write cap', async () => {
    const day = new Date().toISOString().slice(0, 10);
    sqlite.prepare(`INSERT INTO studio_usage (user_id, day, writes, bytes) VALUES (?, ?, ?, 0) ON CONFLICT(user_id, day) DO UPDATE SET writes = excluded.writes`).run(luis.id, day, STUDIO_DAILY_WRITES);
    expect((await take(luis, new Uint8Array([1]))).status).toBe(429);
    expect((await call(luis, 'POST', `/studio/lines/${LINE}/comments`, { text: 'hola' })).status).toBe(429);
    // Others are not affected.
    expect((await call(ana, 'POST', `/studio/lines/${LINE}/comments`, { text: 'hola' })).status).toBe(201);
  });

  it('checks the line id, the audio type and the audio itself', async () => {
    expect((await take(ana, anaAudio, 'not-a-hash')).status).toBe(400);
    expect((await take(ana, new Uint8Array(0))).status).toBe(400);
    expect((await take(ana, anaAudio, LINE, META, 'video/mp4')).status).toBe(400);
    expect((await take(ana, anaAudio, LINE, { ...META, tone: 'savage' })).status).toBe(400);
  });
});
