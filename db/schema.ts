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
