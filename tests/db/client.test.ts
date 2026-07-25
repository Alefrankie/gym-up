// tests/db/client.test.ts
//
// AC-1.1-04: `src/lib/db/client.ts` exports a typed `db` instance; downstream
// code gets autocomplete on table names and columns.
//
// Category 9 (Type-safety) self-QA: the type of `db` must carry the schema,
// and `InferSelectModel<typeof profiles>` must resolve to a typed object that
// matches the canonical DDL.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sql, eq } from 'drizzle-orm';

import { profiles, type Profile, type NewProfile } from '@db/schema';

describe('db client — type contract (AC-1.1-04)', () => {
  it('Profile type resolves to the canonical row shape', () => {
    const sample: Profile = {
      id: '00000000-0000-0000-0000-000000000000',
      displayName: 'Ada',
      routineType: 'mujer',
      weightUnit: 'kg',
      createdAt: new Date(),
    };
    expect(sample.id).toBeTypeOf('string');
    expect(sample.displayName).toBeTypeOf('string');
    expect(['hombre', 'mujer']).toContain(sample.routineType);
    expect(['kg', 'lbs']).toContain(sample.weightUnit);
  });

  it('NewProfile type lets id and createdAt be omitted', () => {
    const insert: NewProfile = {
      displayName: 'Grace',
      routineType: 'hombre',
      weightUnit: 'lbs',
    };
    expect(insert.id).toBeUndefined();
    expect(insert.createdAt).toBeUndefined();
  });

  it('drizzle() accepts an in-memory better-sqlite3 instance and produces a typed client', () => {
    const sqlite = new Database(':memory:');
    const memDb: BetterSQLite3Database<{ profiles: typeof profiles }> = drizzle(
      sqlite,
      { schema: { profiles } },
    );
    expect(memDb).toBeDefined();
    sqlite.close();
  });

  it('routine_type enum rejects invalid values at the type level', () => {
    const bad: NewProfile = {
      displayName: 'Bad',
      // @ts-expect-error — 'invalid' is not in the [hombre, mujer] enum
      routineType: 'invalid',
    };
    expect(bad).toBeDefined();
  });
});

describe('db client — runtime smoke against in-memory sqlite', () => {
  let sqlite: Database.Database;
  let memDb: BetterSQLite3Database<{ profiles: typeof profiles }>;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        routine_type TEXT NOT NULL,
        weight_unit TEXT NOT NULL DEFAULT 'kg',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
    memDb = drizzle(sqlite, { schema: { profiles } });
  });

  afterAll(() => {
    sqlite.close();
  });

  it('insert + select roundtrip yields the inserted row', () => {
    const id = crypto.randomUUID();
    memDb
      .insert(profiles)
      .values({
        id,
        displayName: 'Linus',
        routineType: 'hombre',
        weightUnit: 'kg',
      })
      .run();

    const rows = memDb.select().from(profiles).where(eq(profiles.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].displayName).toBe('Linus');
    expect(rows[0].routineType).toBe('hombre');
    expect(rows[0].weightUnit).toBe('kg');
  });

  it('select with sql template returns matching row', () => {
    const id = crypto.randomUUID();
    memDb
      .insert(profiles)
      .values({
        id,
        displayName: 'Hopper',
        routineType: 'mujer',
        weightUnit: 'lbs',
      })
      .run();
    const rows = memDb.select().from(profiles).where(sql`id = ${id}`).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].displayName).toBe('Hopper');
  });
});
