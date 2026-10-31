// Voice studio lines: added lines (admin approves collaborators' ones), edits of any line with history and revert,
// content rules on every typed text, and takes of a previous text that stop playing until confirmed or re-recorded.

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
import { coachCatalogSchema, coachRecordingListSchema, sessionResponseSchema, studioHistorySchema, studioOverviewSchema } from '@gym-up/contracts';

const fakeHasher: PasswordHasher = { hash: async (p) => `fake$${p}`, verify: async (p, h) => h === `fake$${p}` };
let app: INestApplication;
let base: string;
let admin: { token: string; id: string };
let ana: { token: string; id: string };

const BUILT_IN = 'd'.repeat(32);
const ORIGINAL = '¡Se acabó el descanso, marico!';

async function register(email: string, displayName: string) {
  const r = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'longenough', displayName, routineType: 'hombre', weightUnit: 'kg' }),
  });
  const s = sessionResponseSchema.parse(await r.json());
  return { token: s.token, id: s.user.id };
}

const call = (who: { token: string }, method: string, path: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${who.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const take = (who: { token: string }, line: string, text: string, bytes: number[]) =>
  fetch(`${base}/studio/lines/${line}/take?${new URLSearchParams({ tone: 'gymrat', locale: 'es', event: 'restEnd', text })}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${who.token}`, 'content-type': 'audio/webm' },
    body: new Uint8Array(bytes) as Uint8Array<ArrayBuffer>,
  });
const catalog = async (who: { token: string }) => coachCatalogSchema.parse(await (await call(who, 'GET', '/coach/catalog')).json());
const manifest = async (who: { token: string }) => coachRecordingListSchema.parse(await (await call(who, 'GET', '/coach/recordings')).json()).items;
const overview = async (who: { token: string }) => studioOverviewSchema.parse(await (await call(who, 'GET', '/studio/overview')).json());
const history = async (who: { token: string }, line: string) => studioHistorySchema.parse(await (await call(who, 'GET', `/studio/lines/${line}/history`)).json()).items;

beforeAll(async () => {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = join(__dirname, '../../db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  ({ app } = await createApp({ db: drizzle(sqlite, { schema }) as unknown as Db, hasher: fakeHasher }));
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  admin = await register('alefrank.m@gmail.com', 'Ale');
  ana = await register('ana@example.com', 'Ana');
  expect((await call(admin, 'PUT', `/studio/members/${ana.id}`)).status).toBe(204);
});

afterAll(async () => {
  await app.close();
});

describe('added lines', () => {
  it("plays the admin's lines at once and holds a collaborator's until the admin approves", async () => {
    const mine = await call(admin, 'POST', '/studio/custom-lines', { tone: 'gymrat', locale: 'es', event: 'home', textM: '¡Arriba, chamo!', textF: '¡Arriba, chama!' });
    expect(mine.status).toBe(201);
    const { items } = (await mine.json()) as { items: { form: string; status: string; lineId: string }[] };
    expect(items.map((i) => [i.form, i.status])).toEqual([['m', 'approved'], ['f', 'approved']]);
    expect(new Set(items.map((i) => i.lineId)).size).toBe(2);

    const proposed = await call(ana, 'POST', '/studio/custom-lines', { tone: 'flower', locale: 'es', event: 'finish', textM: 'Lo hiciste precioso.', textF: 'Lo hiciste precioso.' });
    const p = (await proposed.json()) as { items: { form: string | null; status: string; groupId: string }[] };
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).toMatchObject({ form: null, status: 'pending' });

    let c = await catalog(ana);
    expect(c.custom.map((l) => l.text).sort()).toEqual(['¡Arriba, chama!', '¡Arriba, chamo!']);
    expect((await call(ana, 'PUT', `/studio/custom-lines/${p.items[0]!.groupId}/approve`)).status).toBe(403);
    expect((await call(admin, 'PUT', `/studio/custom-lines/${p.items[0]!.groupId}/approve`)).status).toBe(204);
    c = await catalog(ana);
    expect(c.custom.map((l) => l.text)).toContain('Lo hiciste precioso.');
  });

  it('applies the content rules to every typed line', async () => {
    const add = (body: object) => call(ana, 'POST', '/studio/custom-lines', { tone: 'normal', locale: 'es', event: 'home', ...body });
    expect((await add({ textM: 'Estás gordo, muévete' })).status).toBe(400);
    expect((await add({ textM: '¡Coño, a entrenar!' })).status).toBe(400);
    expect((await add({ tone: 'gymrat', textM: '¡Coño, a entrenar!' })).status).toBe(201);
    expect((await add({ tone: 'gymrat', locale: 'en', textM: 'Lift it!' })).status).toBe(400);
    expect((await add({ textM: 'Hola {name}' })).status).toBe(400);
    expect((await add({ textM: 'Sigue aunque duela' })).status).toBe(400);
    expect((await add({ event: 'nope', textM: 'Hola' })).status).toBe(400);
  });

  it('lets an author withdraw a pending line, and only the admin delete approved ones (with their takes)', async () => {
    const pending = (await (await call(ana, 'POST', '/studio/custom-lines', { tone: 'normal', locale: 'es', event: 'pr', textM: '¡Récord!' })).json()) as { items: { groupId: string }[] };
    expect((await call(ana, 'DELETE', `/studio/custom-lines/${pending.items[0]!.groupId}`)).status).toBe(204);

    const o = await overview(ana);
    const approved = o.custom.find((l) => l.text === 'Lo hiciste precioso.')!;
    expect((await take(ana, approved.lineId, approved.text, [1, 2])).status).toBe(200);
    expect((await call(ana, 'DELETE', `/studio/custom-lines/${approved.groupId}`)).status).toBe(403);
    expect((await call(admin, 'DELETE', `/studio/custom-lines/${approved.groupId}`)).status).toBe(204);
    const after = await overview(ana);
    expect(after.custom.find((l) => l.groupId === approved.groupId)).toBeUndefined();
    expect(after.takes.find((t) => t.lineId === approved.lineId)).toBeUndefined();
  });
});

describe('editing a line', () => {
  it('lets only the admin edit, keeps the history, and serves the new text to the app', async () => {
    expect((await take(admin, BUILT_IN, ORIGINAL, [7, 7, 7])).status).toBe(200);
    expect((await manifest(ana)).map((r) => r.text)).toContain(ORIGINAL);

    const edit = { text: '¡Se acabó el recreo, marico!', originalText: ORIGINAL, tone: 'gymrat', locale: 'es', event: 'restEnd', form: null };
    expect((await call(ana, 'PUT', `/studio/lines/${BUILT_IN}/text`, edit)).status).toBe(403);
    expect((await call(admin, 'PUT', `/studio/lines/${BUILT_IN}/text`, { text: 'Nuevo' })).status).toBe(400);
    expect((await call(admin, 'PUT', `/studio/lines/${BUILT_IN}/text`, { ...edit, text: 'Eres un tarado' })).status).toBe(400);
    expect((await call(admin, 'PUT', `/studio/lines/${BUILT_IN}/text`, edit)).status).toBe(204);

    expect((await catalog(ana)).overrides).toEqual([{ lineId: BUILT_IN, originalText: ORIGINAL, text: edit.text }]);
    const h = await history(ana, BUILT_IN);
    expect(h.map((e) => [e.kind, e.previousText, e.newText, e.authorName])).toEqual([['edit', ORIGINAL, edit.text, 'Ale']]);
  });

  it('stops playing takes of the previous text until the admin confirms them or someone records the new text', async () => {
    // The active take says the old text: the app no longer gets it.
    expect((await manifest(ana)).find((r) => r.id === BUILT_IN)).toBeUndefined();
    expect((await call(ana, 'GET', `/coach/recordings/${BUILT_IN}`)).status).toBe(404);

    const stale = (await overview(admin)).takes.find((t) => t.lineId === BUILT_IN)!;
    expect(stale.text).toBe(ORIGINAL);
    expect((await call(admin, 'PUT', `/studio/lines/${BUILT_IN}/active`, { takeId: stale.id })).status).toBe(400);
    expect((await call(ana, 'POST', `/studio/takes/${stale.id}/confirm`)).status).toBe(403);
    expect((await call(admin, 'POST', `/studio/takes/${stale.id}/confirm`)).status).toBe(204);
    const playing = await manifest(ana);
    expect(playing.find((r) => r.id === BUILT_IN)?.text).toBe('¡Se acabó el recreo, marico!');

    // Ana records the new text: a playable take of the current text.
    expect((await take(ana, BUILT_IN, '¡Se acabó el recreo, marico!', [3])).status).toBe(200);
    const anaTake = (await overview(admin)).takes.find((t) => t.lineId === BUILT_IN && t.authorId === ana.id)!;
    expect((await call(admin, 'PUT', `/studio/lines/${BUILT_IN}/active`, { takeId: anaTake.id })).status).toBe(204);
  });

  it('reverts to the original text, with history', async () => {
    expect((await call(ana, 'DELETE', `/studio/lines/${BUILT_IN}/text`)).status).toBe(403);
    expect((await call(admin, 'DELETE', `/studio/lines/${BUILT_IN}/text`)).status).toBe(204);
    expect((await catalog(ana)).overrides).toEqual([]);
    expect((await history(ana, BUILT_IN)).map((e) => e.kind)).toEqual(['edit', 'revert']);
  });

  it('edits and reverts an added line', async () => {
    const line = (await catalog(ana)).custom.find((l) => l.text === '¡Arriba, chamo!')!;
    expect((await call(admin, 'PUT', `/studio/lines/${line.lineId}/text`, { text: '¡Arriba, mi pana!' })).status).toBe(204);
    expect((await catalog(ana)).custom.find((l) => l.lineId === line.lineId)?.text).toBe('¡Arriba, mi pana!');
    expect((await call(admin, 'DELETE', `/studio/lines/${line.lineId}/text`)).status).toBe(204);
    expect((await catalog(ana)).custom.find((l) => l.lineId === line.lineId)?.text).toBe('¡Arriba, chamo!');
    expect((await history(ana, line.lineId)).map((e) => e.kind)).toEqual(['create', 'edit', 'revert']);
  });
});
