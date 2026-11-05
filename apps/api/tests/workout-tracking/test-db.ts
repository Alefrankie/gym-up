// tests/workout-tracking/test-db.ts
//
// Shared in-memory SQLite test harness for workout-tracking repo tests.
// Spins up an ephemeral database with ALL canonical tables (profiles +
// workout-tracking) so the `Db` type (which requires the full schema)
// satisfies the repository constructor signature.
//
// Per golden-rules (Test Fixtures): updated to match current schema shape
// after the 1.2 expansion. Legacy single-table fixture was contract drift.

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@db/schema';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type TestDb = BetterSQLite3Database<typeof schema>;

export interface TestDbHandle {
  db: TestDb;
  sqlite: Database.Database;
  close: () => void;
}

/** The real migrations, in order: a hand-written copy of the schema drifted every time a column was added. */
const MIGRATIONS_DIR = join(__dirname, '../../db/migrations');
const DDL = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  .join(';\n');

/**
 * Create a fresh in-memory SQLite + Drizzle client with the full migrated schema.
 * Caller must `close()` to free the handle (Vitest `afterAll`).
 */
export function createTestDb(): TestDbHandle {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema }) as TestDb;
  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}

/**
 * Build an isolated tmp-dir for filesystem-backed photo tests.
 * Caller must `rmSync(dir, { recursive: true, force: true })` to clean up.
 */
export function createTestUploadsDir(): { dir: string; cleanup: () => void } {
  const dir = join(
    process.cwd(),
    '.tmp-test-uploads',
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  return {
    dir,
    cleanup: () => {
      try {
        // Best-effort cleanup; ignore errors so tests don't crash on teardown.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('node:fs').rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}
