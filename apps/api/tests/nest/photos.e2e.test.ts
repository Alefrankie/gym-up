// tests/nest/photos.e2e.test.ts
//
// Private photos over real HTTP with the real use cases, the SQLite repository and an in-memory object store.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import * as schema from '@db/schema';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { InMemoryPhotoStorage } from '@/lib/contexts/private-photos/infrastructure/in-memory-photo-storage';
import { createApp } from '../../src/nest/create-app';
import { photoListResponseSchema, photoSchema, sessionResponseSchema } from '@gym-up/contracts';

const fakeHasher: PasswordHasher = { hash: async (p) => `fake$${p}`, verify: async (p, h) => h === `fake$${p}` };

function freshDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  return drizzle(sqlite, { schema }) as unknown as Db;
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 1, 2, 3, 4, 5, 6, 7, 8, 0xff, 0xd9]);

let app: INestApplication;
let base: string;
let storage: InMemoryPhotoStorage;
let bareApp: INestApplication;
let bareBase: string;

async function listen(a: INestApplication): Promise<string> {
  await a.listen(0, '127.0.0.1');
  return (await a.getUrl()).replace('[::1]', '127.0.0.1');
}

async function call(root: string, method: string, path: string, opts: { token?: string; body?: BodyInit; contentType?: string } = {}) {
  const res = await fetch(root + path, {
    method,
    headers: { ...(opts.contentType ? { 'content-type': opts.contentType } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body,
  });
  return res;
}

async function register(root: string, email: string) {
  const r = await fetch(root + '/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'longenough', displayName: 'Fotos', routineType: 'hombre' }),
  });
  return sessionResponseSchema.parse(await r.json());
}

const upload = (token: string, id: string, bytes: Uint8Array = JPEG, type = 'image/jpeg', query = '') =>
  call(base, 'PUT', `/photos/${id}${query}`, { token, body: bytes as unknown as BodyInit, contentType: type });

beforeAll(async () => {
  storage = new InMemoryPhotoStorage();
  app = (await createApp({ db: freshDb(), hasher: fakeHasher, photoStorage: storage })).app;
  base = await listen(app);
  bareApp = (await createApp({ db: freshDb(), hasher: fakeHasher })).app;
  bareBase = await listen(bareApp);
});

afterAll(async () => {
  await app.close();
  await bareApp.close();
});

describe('photos', () => {
  it('requires authentication', async () => {
    expect((await call(base, 'GET', '/photos')).status).toBe(401);
    expect((await call(base, 'PUT', `/photos/${crypto.randomUUID()}`, { body: JPEG as unknown as BodyInit, contentType: 'image/jpeg' })).status).toBe(401);
  });

  it('answers 503 on every photo route when no object store is configured, and the rest of the API still works', async () => {
    const s = await register(bareBase, 'nostore@example.com');
    expect((await call(bareBase, 'GET', '/photos', { token: s.token })).status).toBe(503);
    expect((await call(bareBase, 'GET', '/progress/streak', { token: s.token })).status).toBe(200);
  });

  it('uploads, lists, serves the bytes back and deletes (owner only)', async () => {
    const owner = await register(base, 'photo-owner@example.com');
    const id = crypto.randomUUID();

    const created = await upload(owner.token, id, JPEG, 'image/jpeg', '?caption=Semana%201');
    expect(created.status).toBe(201);
    expect(photoSchema.parse(await created.json())).toMatchObject({ id, caption: 'Semana 1', contentType: 'image/jpeg' });

    const list = photoListResponseSchema.parse(await (await call(base, 'GET', '/photos', { token: owner.token })).json());
    expect(list.map((p) => p.id)).toEqual([id]);

    const file = await call(base, 'GET', `/photos/${id}/file`, { token: owner.token });
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/jpeg');
    expect(file.headers.get('cache-control')).toContain('private');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(JPEG);

    const del = await call(base, 'DELETE', `/photos/${id}`, { token: owner.token });
    expect(del.status).toBe(204);
    expect((await call(base, 'GET', `/photos/${id}/file`, { token: owner.token })).status).toBe(404);
    expect((await call(base, 'GET', '/photos', { token: owner.token })).json).toBeDefined();
  });

  it('is idempotent by client id: replaying an upload stores one object', async () => {
    const s = await register(base, 'photo-replay@example.com');
    const id = crypto.randomUUID();
    const before = storage.size;
    expect((await upload(s.token, id)).status).toBe(201);
    expect((await upload(s.token, id)).status).toBe(200);
    expect(storage.size).toBe(before + 1);
  });

  it('never shows or deletes another user\'s photo (404, so ids cannot be probed)', async () => {
    const a = await register(base, 'photo-a@example.com');
    const b = await register(base, 'photo-b@example.com');
    const id = crypto.randomUUID();
    await upload(a.token, id);

    expect((await call(base, 'GET', `/photos/${id}/file`, { token: b.token })).status).toBe(404);
    expect((await call(base, 'DELETE', `/photos/${id}`, { token: b.token })).status).toBe(404);
    expect(photoListResponseSchema.parse(await (await call(base, 'GET', '/photos', { token: b.token })).json())).toEqual([]);
    // Still there for the owner.
    expect((await call(base, 'GET', `/photos/${id}/file`, { token: a.token })).status).toBe(200);
  });

  it('validates the upload: type 415, size 413, caption 400, id 400', async () => {
    const s = await register(base, 'photo-validate@example.com');
    const text = await call(base, 'PUT', `/photos/${crypto.randomUUID()}`, { token: s.token, body: 'not an image', contentType: 'text/plain' });
    expect(text.status).toBe(415);

    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    expect((await upload(s.token, crypto.randomUUID(), big)).status).toBe(413);
    const huge = new Uint8Array(7 * 1024 * 1024);
    expect((await upload(s.token, crypto.randomUUID(), huge)).status).toBe(413);

    const longCaption = encodeURIComponent('x'.repeat(201));
    expect((await upload(s.token, crypto.randomUUID(), JPEG, 'image/jpeg', `?caption=${longCaption}`)).status).toBe(400);
    expect((await upload(s.token, 'not-a-uuid')).status).toBe(400);
  });
});
