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
import { join } from 'node:path';

export type TestDb = BetterSQLite3Database<typeof schema>;

export interface TestDbHandle {
  db: TestDb;
  sqlite: Database.Database;
  close: () => void;
}

const DDL = `
  CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    routine_type TEXT NOT NULL,
    weight_unit TEXT NOT NULL DEFAULT 'kg',
    body_weight_kg REAL,
    coach_tone TEXT NOT NULL DEFAULT 'normal',
    address_form TEXT NOT NULL DEFAULT 'm',
    address_form_chosen INTEGER NOT NULL DEFAULT 0,
    active_program_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    muscle_group TEXT NOT NULL,
    secondary_muscles TEXT NOT NULL DEFAULT '[]',
    equipment TEXT NOT NULL DEFAULT 'other',
    exercise_type TEXT NOT NULL DEFAULT 'weight_reps',
    instructions TEXT,
    video_url TEXT,
    owner_id TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    owner_id TEXT,
    source_template_id TEXT,
    description TEXT,
    is_template INTEGER NOT NULL DEFAULT 0,
    level TEXT,
    goal TEXT,
    days_per_week INTEGER,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE routine_days (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    day_name TEXT NOT NULL,
    focus TEXT NOT NULL,
    notes TEXT,
    weekday INTEGER
  );
  CREATE TABLE routine_exercises (
    id TEXT PRIMARY KEY,
    routine_day_id TEXT NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    target_sets INTEGER NOT NULL DEFAULT 4,
    target_reps INTEGER NOT NULL DEFAULT 10,
    exercise_order INTEGER NOT NULL,
    target_reps_min INTEGER,
    target_reps_max INTEGER,
    warmup_sets INTEGER NOT NULL DEFAULT 0,
    rest_seconds INTEGER,
    notes TEXT,
    set_plan TEXT
  );
  CREATE TABLE workouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    routine_day_id TEXT NOT NULL REFERENCES routine_days(id),
    workout_date INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    status TEXT NOT NULL DEFAULT 'in_progress',
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER
  );
  CREATE TABLE workout_entries (
    id TEXT PRIMARY KEY,
    workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    set_number INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'normal',
    reps INTEGER NOT NULL,
    weight INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE progress_photos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    photo_date INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    caption TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE nutrition_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    photo_date INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    total_calories INTEGER NOT NULL DEFAULT 0,
    total_protein INTEGER NOT NULL DEFAULT 0,
    total_carbs INTEGER NOT NULL DEFAULT 0,
    total_fat INTEGER NOT NULL DEFAULT 0,
    food_items TEXT NOT NULL,
    ai_raw_response TEXT,
    user_edited INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE nutrition_goals (
    user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    daily_calorie_goal INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`;

/**
 * Create a fresh in-memory SQLite + Drizzle client with all 10 tables.
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
