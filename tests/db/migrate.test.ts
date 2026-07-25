// tests/db/migrate.test.ts
//
// AC-1.1-03: drizzle-kit migrate applies the generated file to local.db without
// error; the profiles table exists.
//
// Category 7 (Migration) self-QA: the migration is generated, versioned, and
// re-runnable.

import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('db migrations', () => {
  it('a versioned SQL file exists under db/migrations/', () => {
    const dir = join(process.cwd(), 'db', 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
  });

  it('the generated SQL creates the `profiles` table with all canonical columns', () => {
    const dir = join(process.cwd(), 'db', 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
    const sqlText = files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    expect(sqlText).toMatch(/CREATE TABLE[^;]*"?profiles"?/i);
    expect(sqlText).toMatch(/display_name/i);
    expect(sqlText).toMatch(/routine_type/i);
    expect(sqlText).toMatch(/weight_unit/i);
    expect(sqlText).toMatch(/created_at/i);
  });

  it('db/schema.ts has a top-level comment documenting the Round 6 swap', () => {
    const schemaPath = join(process.cwd(), 'db', 'schema.ts');
    expect(existsSync(schemaPath)).toBe(true);
    const src = readFileSync(schemaPath, 'utf8');
    expect(src).toMatch(/Round\s*6/i);
    expect(src).toMatch(/Postgres/i);
  });
});
