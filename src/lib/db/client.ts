// src/lib/db/client.ts
//
// Single Drizzle client instance, reused everywhere (ADR-012).
// In serverless (Vercel) contexts a single instance per cold start is fine;
// better-sqlite3 is synchronous and process-local, so re-creating per
// request would be wasteful and would also break transactions that span
// multiple statements.

import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as schema from '@db/schema';

/**
 * Best-effort .env loader. Astro/Vite normally injects env vars via
 * `import.meta.env`, but the rest of the codebase (and this module) reads
 * from `process.env` so the same client can be used in tests, the Astro
 * SSR runtime, and Vercel functions without per-environment branching.
 */
function loadDotEnvIfPresent(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvIfPresent();

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env before booting the app.',
    );
  }
  // Drizzle expects a plain file path; we accept the `file:./local.db` form
  // because that is what `drizzle.config.ts` and Vercel integration use.
  return raw.replace(/^file:/, '');
}

const sqlite = new Database(resolveDbPath());
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });
export type Db = typeof db;
