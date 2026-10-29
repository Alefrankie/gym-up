// db/seed-cli.ts
//
// Local development seeding: applies `seedReferenceData` to a better-sqlite3 file.
// Run migrations first (`pnpm db:migrate`), then `pnpm db:seed`.

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { seedReferenceData } from './seed';
import type { Db } from '../src/lib/db/client';

const path = (process.env.DATABASE_URL ?? 'file:./local.db').replace(/^file:/, '');
const sqlite = new Database(path);
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema }) as unknown as Db;

seedReferenceData(db).catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
