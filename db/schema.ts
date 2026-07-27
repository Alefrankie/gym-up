// db/schema.ts
//
// =============================================================
// SINGLE SOURCE OF TRUTH for the canonical tables.
// =============================================================
//
// This file is reused in Round 6 against Postgres per ADR-012.
// The Round 1 (SQLite) and Round 6 (Postgres) versions are
// kept structurally identical so the swap is mechanical:
//
//   1. Replace `sqliteTable` import with `pgTable`.
//   2. Replace `text` PK with `uuid` for tables that reference
//      Supabase `auth.users` (`profiles.id`).
//   3. Add `.references(() => <authTable>.id)` for FKs that
//      SQLite skipped in Round 1 (no local `auth.users`).
//   4. Replace `integer({ mode: 'timestamp' })` with `timestamp`.
//   5. Update `drizzle.config.ts` dialect flag and driver
//      import in `src/lib/db/client.ts`.
//
// Until then, RLS-equivalent guards live in the repository
// layer (SqliteXxxRepository) per ADR-004 / ADR-005 / ADR-007.
// =============================================================

import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * User profile. Created on registration (Round 1: in LocalAuthService
 * transaction; Round 6: via a `handle_new_user()` trigger on auth.users).
 *
 * Round 1: `id` is generated client-side via crypto.randomUUID().
 * Round 6: `id` becomes `uuid('id').primaryKey().references(() => authUsers.id)`.
 */
export const profiles = sqliteTable('profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  routineType: text('routine_type', { enum: ['hombre', 'mujer'] }).notNull(),
  weightUnit: text('weight_unit', { enum: ['kg', 'lbs'] })
    .notNull()
    .default('kg'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

/**
 * Exercise catalog (seed data per ADR-003).
 * Read-all (no userId): exercises are shared across all users.
 * `muscleGroup` enables filtering (chest, back, legs, etc.).
 */
export const exercises = sqliteTable('exercises', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  muscleGroup: text('muscle_group').notNull(),
});

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

/**
 * Routine header (hombre / mujer). Seed data per ADR-003.
 * `type` mirrors profiles.routineType; routines are global, not per-user.
 */
export const routines = sqliteTable('routines', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: ['hombre', 'mujer'] }).notNull(),
});

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;

/**
 * One day of a routine (e.g. "Monday — Chest + Shoulders + Triceps").
 * Cascade-delete with parent routine.
 * `dayNumber` 1-7, unique per routine.
 */
export const routineDays = sqliteTable('routine_days', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  routineId: text('routine_id')
    .notNull()
    .references(() => routines.id, { onDelete: 'cascade' }),
  dayNumber: integer('day_number').notNull(),
  dayName: text('day_name').notNull(),
  focus: text('focus').notNull(),
});

export type RoutineDay = typeof routineDays.$inferSelect;
export type NewRoutineDay = typeof routineDays.$inferInsert;

/**
 * Exercise slot inside a routine day (target sets/reps/order).
 * Cascade-delete with parent routine_day.
 */
export const routineExercises = sqliteTable('routine_exercises', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  routineDayId: text('routine_day_id')
    .notNull()
    .references(() => routineDays.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  targetSets: integer('target_sets').notNull().default(4),
  targetReps: integer('target_reps').notNull().default(10),
  exerciseOrder: integer('exercise_order').notNull(),
});

export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;

/**
 * A workout session: user + routine_day + date.
 * `workoutDate` stored as ms-since-epoch (DATE in Postgres Round 6).
 * `status`: 'in_progress' | 'completed'.
 * Visibility: write-own (userId), read-all (ADR-004).
 */
export const workouts = sqliteTable('workouts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  routineDayId: text('routine_day_id')
    .notNull()
    .references(() => routineDays.id),
  workoutDate: integer('workout_date', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  status: text('status', { enum: ['in_progress', 'completed'] })
    .notNull()
    .default('in_progress'),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

/**
 * A single set logged inside a workout.
 * Cascade-delete with parent workout.
 * `weight` is stored in KG per ADR-006 (display conversion at UI).
 */
export const workoutEntries = sqliteTable('workout_entries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workoutId: text('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps').notNull(),
  weight: integer('weight').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type WorkoutEntry = typeof workoutEntries.$inferSelect;
export type NewWorkoutEntry = typeof workoutEntries.$inferInsert;

/**
 * Progress photo metadata. Owner-only per ADR-005.
 * `storagePath` is the relative path to the file on local filesystem
 * (Round 6 swaps to Supabase Storage).
 * Round 1: `./uploads/photos/{user_id}/{timestamp}.jpg`.
 */
export const progressPhotos = sqliteTable('progress_photos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  photoDate: integer('photo_date', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  caption: text('caption'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type NewProgressPhoto = typeof progressPhotos.$inferInsert;

/**
 * User session. Stores session data for authentication.
 * Round 1: SQLite sessions table with httpOnly cookie.
 * Round 6: Supabase Auth handles sessions.
 */
export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' })
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
