// The voice studio's recordings: admins record, everyone signed in lists and plays them. Real HTTP and migrations.

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
import { coachRecordingListSchema, sessionResponseSchema, userSchema } from '@gym-up/contracts';

const fakeHasher: PasswordHasher = { hash: async (p) => `fake$${p}`, verify: async (p, h) => h === `fake$${p}` };
let app: INestApplication;
let base: string;
let admin: string;
let member: string;

const ID = 'a'.repeat(32);
const META = { tone: 'gymrat', locale: 'es', event: 'restEnd', form: 'm', text: '¡Se acabó el descanso, marico!' };
const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

async function register(email: string) {
  const r = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'longenough', displayName: 'Tester', routineType: 'hombre', weightUnit: 'kg' }),
  });
  return sessionResponseSchema.parse(await r.json());
}

const put = (token: string, id = ID, meta: Record<string, string> = META, body: Uint8Array = audio, type = 'audio/webm;codecs=opus') =>
  fetch(`${base}/coach/recordings/${id}?${new URLSearchParams(meta)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': type },
    body: body as Uint8Array<ArrayBuffer>,
  });

beforeAll(async () => {
  const sqlite = new Database(':memory:');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  const db = drizzle(sqlite, { schema }) as unknown as Db;
  ({ app } = await createApp({ db, hasher: fakeHasher }));
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const a = await register('Alefrank.M@gmail.com');
  admin = a.token;
  expect(a.user.isAdmin).toBe(true);
  const m = await register('member@example.com');
  member = m.token;
  expect(m.user.isAdmin).toBe(false);
});

afterAll(async () => {
  await app.close();
});

describe('voice studio recordings', () => {
  it('tells the app who is an admin', async () => {
    const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${member}` } });
    expect(userSchema.parse(await me.json()).isAdmin).toBe(false);
  });

  it('lets only admins record, replace and delete', async () => {
    expect((await put(member)).status).toBe(403);
    const saved = await put(admin);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ id: ID, ...META, bytes: audio.length, contentType: 'audio/webm;codecs=opus' });
    expect((await fetch(`${base}/coach/recordings/${ID}`, { method: 'DELETE', headers: { authorization: `Bearer ${member}` } })).status).toBe(403);
  });

  it('lists and plays recordings for anyone signed in, with a version that changes on a new take', async () => {
    const list = coachRecordingListSchema.parse(await (await fetch(`${base}/coach/recordings`, { headers: { authorization: `Bearer ${member}` } })).json());
    const item = list.items.find((i) => i.id === ID)!;
    expect(item).toMatchObject({ tone: 'gymrat', event: 'restEnd', form: 'm' });

    const play = await fetch(`${base}/coach/recordings/${ID}?v=${item.updatedAt}`, { headers: { authorization: `Bearer ${member}` } });
    expect(play.status).toBe(200);
    expect(play.headers.get('content-type')).toContain('audio/webm');
    expect(new Uint8Array(await play.arrayBuffer())).toEqual(audio);

    await new Promise((r) => setTimeout(r, 5));
    const retake = new Uint8Array([9, 9, 9]);
    expect((await put(admin, ID, META, retake, 'audio/ogg')).status).toBe(200);
    const after = coachRecordingListSchema.parse(await (await fetch(`${base}/coach/recordings`, { headers: { authorization: `Bearer ${member}` } })).json());
    const updated = after.items.find((i) => i.id === ID)!;
    expect(updated.updatedAt).toBeGreaterThan(item.updatedAt);
    expect(updated.bytes).toBe(3);
  });

  it('deletes', async () => {
    expect((await fetch(`${base}/coach/recordings/${ID}`, { method: 'DELETE', headers: { authorization: `Bearer ${admin}` } })).status).toBe(204);
    expect((await fetch(`${base}/coach/recordings/${ID}`, { headers: { authorization: `Bearer ${member}` } })).status).toBe(404);
  });

  it('checks the id, the line, the audio type and size, and the session', async () => {
    expect((await fetch(`${base}/coach/recordings`)).status).toBe(401);
    expect((await put(admin, 'not-a-hash')).status).toBe(400);
    expect((await put(admin, ID, { ...META, tone: 'savage' })).status).toBe(400);
    expect((await put(admin, ID, META, new Uint8Array(0))).status).toBe(400);
    expect((await put(admin, ID, META, audio, 'video/mp4')).status).toBe(400);
  });
});
