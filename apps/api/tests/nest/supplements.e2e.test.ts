// End-to-end tests of the exercise library (ADR-017) and user-owned programs (ADR-018),
// over real HTTP with the real migrations and seed.

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
import { sessionResponseSchema, supplementListResponseSchema } from '@gym-up/contracts';

const fakeHasher: PasswordHasher = {
  hash: async (p) => `fake$${p}`,
  verify: async (p, h) => h === `fake$${p}`,
};

let app: INestApplication;
let db: Db;
let base: string;

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

async function register(email: string, routineType: 'hombre' | 'mujer' = 'hombre') {
  const r = await http('POST', '/auth/register', {
    body: { email, password: 'longenough', displayName: 'Tester', routineType, weightUnit: 'kg' },
  });
  expect(r.status).toBe(201);
  return sessionResponseSchema.parse(r.json);
}

beforeAll(async () => {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  }
  db = drizzle(sqlite, { schema }) as unknown as Db;
  await seedReferenceData(db);
  const created = await createApp({ db, hasher: fakeHasher });
  app = created.app;
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app.close();
});

describe('supplements', () => {
  it('seeds the defaults, ticks a day, counts the streak and archives', async () => {
    const s = await register('supp@example.com');
    const day = '2026-10-29';
    const first = supplementListResponseSchema.parse((await http('GET', `/supplements?day=${day}`, { token: s.token })).json);
    expect(first.items.map((i) => i.name)).toEqual(['Creatina', 'Proteína', 'Preentreno']);
    expect(first.items.every((i) => !i.taken && i.streak === 0)).toBe(true);

    const creatine = first.items[0]!.id;
    for (const d of ['2026-10-27', '2026-10-28', day]) {
      expect((await http('PUT', `/supplements/${creatine}/log`, { token: s.token, body: { day: d, taken: true } })).status).toBe(204);
    }
    // ticking twice is harmless
    await http('PUT', `/supplements/${creatine}/log`, { token: s.token, body: { day, taken: true } });
    const ticked = supplementListResponseSchema.parse((await http('GET', `/supplements?day=${day}`, { token: s.token })).json);
    expect(ticked.items[0]).toMatchObject({ taken: true, streak: 3, days: ['2026-10-27', '2026-10-28', day] });

    await http('PUT', `/supplements/${creatine}/log`, { token: s.token, body: { day, taken: false } });
    const unticked = supplementListResponseSchema.parse((await http('GET', `/supplements?day=${day}`, { token: s.token })).json);
    expect(unticked.items[0]).toMatchObject({ taken: false, streak: 2 });

    const id = crypto.randomUUID();
    expect((await http('POST', '/supplements', { token: s.token, body: { id, name: 'Omega 3' } })).status).toBe(201);
    expect((await http('POST', '/supplements', { token: s.token, body: { id, name: 'Omega 3' } })).status).toBe(201);
    expect((await http('DELETE', `/supplements/${first.items[2]!.id}`, { token: s.token })).status).toBe(204);
    const after = supplementListResponseSchema.parse((await http('GET', `/supplements?day=${day}`, { token: s.token })).json);
    expect(after.items.map((i) => i.name)).toEqual(['Creatina', 'Proteína', 'Omega 3']);
  });

  it('keeps supplements private and validates input', async () => {
    const a = await register('supp-a@example.com');
    const b = await register('supp-b@example.com');
    const mine = supplementListResponseSchema.parse((await http('GET', '/supplements?day=2026-10-29', { token: a.token })).json);
    const other = await http('PUT', `/supplements/${mine.items[0]!.id}/log`, { token: b.token, body: { day: '2026-10-29', taken: true } });
    expect(other.status).toBe(404);
    expect((await http('GET', '/supplements', { token: a.token })).status).toBe(400);
    expect((await http('PUT', `/supplements/${mine.items[0]!.id}/log`, { token: a.token, body: { day: '29/10', taken: true } })).status).toBe(400);
  });
});
