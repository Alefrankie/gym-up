// The Coach's cloud voice: GET /coach/voice over real HTTP, with a fake Workers AI binding and an in-memory cache.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import * as schema from '@db/schema';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { InMemoryAudioCache, WorkersAiCoachSpeech, cacheKey } from '@/lib/contexts/coach/coach-speech';
import { D1VoiceBudget } from '@/lib/contexts/coach/d1-voice-budget';
import { createApp } from '../../src/nest/create-app';
import { sessionResponseSchema } from '@gym-up/contracts';

const fakeHasher: PasswordHasher = { hash: async (p) => `fake$${p}`, verify: async (p, h) => h === `fake$${p}` };

const calls: { model: string; input: Record<string, unknown> }[] = [];
const ai = {
  run: async (model: string, input: Record<string, unknown>) => {
    calls.push({ model, input });
    // Workers AI answers with a stream of audio.
    return new Response(new TextEncoder().encode(`OggS:${input.speaker}:${input.text}`)).body;
  },
};
const cache = new InMemoryAudioCache();

let app: INestApplication;
let bare: INestApplication;
let capped: INestApplication;
let base: string;
let bareBase: string;
let cappedBase: string;
let today = new Date('2026-10-30T12:00:00Z');

function freshDb() {
  const sqlite = new Database(':memory:');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  return drizzle(sqlite, { schema }) as unknown as Db;
}

async function boot(withVoice: boolean, capChars?: number) {
  const db = freshDb();
  const budget = capChars === undefined ? undefined : new D1VoiceBudget(db, capChars, () => today);
  const speech = withVoice ? new WorkersAiCoachSpeech(ai, capChars === undefined ? cache : new InMemoryAudioCache(), budget) : undefined;
  const { app } = await createApp({ db, hasher: fakeHasher, coachSpeech: speech });
  await app.listen(0, '127.0.0.1');
  return { app, base: (await app.getUrl()).replace('[::1]', '127.0.0.1') };
}

async function register(at: string) {
  const r = await fetch(`${at}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'coach@example.com', password: 'longenough', displayName: 'Tester', routineType: 'hombre', weightUnit: 'kg' }),
  });
  return sessionResponseSchema.parse(await r.json()).token;
}

const voiceUrl = (at: string, q: Record<string, string>) => `${at}/coach/voice?${new URLSearchParams(q)}`;

beforeAll(async () => {
  ({ app, base } = await boot(true));
  ({ app: bare, base: bareBase } = await boot(false));
  ({ app: capped, base: cappedBase } = await boot(true, 20));
});

afterAll(async () => {
  await app.close();
  await bare.close();
  await capped.close();
});

describe('GET /coach/voice', () => {
  it('generates a line once, then serves it from the cache', async () => {
    const token = await register(base);
    const q = { voice: 'aura:sirio', text: '¡Dale que vamos!' };
    const first = await fetch(voiceUrl(base, q), { headers: { authorization: `Bearer ${token}` } });
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toContain('audio/ogg');
    expect(first.headers.get('x-coach-voice-cache')).toBe('miss');
    expect(await first.text()).toBe('OggS:sirio:¡Dale que vamos!');
    expect(calls.at(-1)).toMatchObject({ model: '@cf/deepgram/aura-2-es', input: { speaker: 'sirio', encoding: 'opus', container: 'ogg' } });

    const again = await fetch(voiceUrl(base, q), { headers: { authorization: `Bearer ${token}` } });
    expect(again.headers.get('x-coach-voice-cache')).toBe('hit');
    expect(calls).toHaveLength(1);
  });

  it('speaks English lines with the male English voice', async () => {
    const token = await register(base).catch(() => '');
    const login = token || sessionResponseSchema.parse(await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'coach@example.com', password: 'longenough' }) })).json()).token;
    const r = await fetch(voiceUrl(base, { voice: 'aura:javier', lang: 'en', text: 'Rest is over.' }), { headers: { authorization: `Bearer ${login}` } });
    expect(r.status).toBe(200);
    expect(calls.at(-1)).toMatchObject({ model: '@cf/deepgram/aura-2-en', input: { speaker: 'orion' } });
  });

  it('keys the cache by voice, language and text', async () => {
    const a = await cacheKey({ voice: 'aura:sirio', lang: 'es', text: 'Hola' });
    expect(a).not.toBe(await cacheKey({ voice: 'aura:javier', lang: 'es', text: 'Hola' }));
    expect(a).not.toBe(await cacheKey({ voice: 'aura:sirio', lang: 'en', text: 'Hola' }));
    expect(a).toBe(await cacheKey({ voice: 'aura:sirio', lang: 'es', text: 'Hola' }));
  });

  it('needs a session, a known male voice and a short text', async () => {
    expect((await fetch(voiceUrl(base, { voice: 'aura:sirio', text: 'Hola' }))).status).toBe(401);
    const token = sessionResponseSchema.parse(await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'coach@example.com', password: 'longenough' }) })).json()).token;
    const auth = { headers: { authorization: `Bearer ${token}` } };
    expect((await fetch(voiceUrl(base, { voice: 'aura:aquila', text: 'Hola' }), auth)).status).toBe(400);
    expect((await fetch(voiceUrl(base, { voice: 'aura:sirio', text: 'x'.repeat(301) }), auth)).status).toBe(400);
    expect((await fetch(voiceUrl(base, { voice: 'aura:sirio', text: '' }), auth)).status).toBe(400);
  });

  it('answers 503 when Workers AI is not configured', async () => {
    const token = await register(bareBase);
    const r = await fetch(voiceUrl(bareBase, { voice: 'aura:sirio', text: 'Hola' }), { headers: { authorization: `Bearer ${token}` } });
    expect(r.status).toBe(503);
  });

  it('never goes past the free daily budget: 429 for new lines, cached lines still play, a new day starts over', async () => {
    const token = await register(cappedBase);
    const auth = { headers: { authorization: `Bearer ${token}` } };
    const first = { voice: 'aura:sirio', text: 'Dale que vamos.' }; // 15 characters of a 20-character day
    expect((await fetch(voiceUrl(cappedBase, first), auth)).status).toBe(200);
    expect((await fetch(voiceUrl(cappedBase, { voice: 'aura:sirio', text: 'Arriba, coño.' }), auth)).status).toBe(429);
    const cached = await fetch(voiceUrl(cappedBase, first), auth);
    expect(cached.status).toBe(200);
    expect(cached.headers.get('x-coach-voice-cache')).toBe('hit');
    today = new Date('2026-10-31T00:00:01Z');
    expect((await fetch(voiceUrl(cappedBase, { voice: 'aura:sirio', text: 'Arriba, coño.' }), auth)).status).toBe(200);
  });
});
