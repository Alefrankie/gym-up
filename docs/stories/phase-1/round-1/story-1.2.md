---
story_id: "1.2"
round: "round-1"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "completed"
started: "2026-07-26"
completed: "2026-07-26"
owner: "crew-flow"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-007"]
  architecture_decisions: ["ADR-003", "ADR-004", "ADR-005", "ADR-006", "ADR-007", "ADR-012"]
  flows: []
blocked_by: ["story-1.1"]
blocks: ["story-1.3", "story-2.1"]
---

# Story 1.2 — Database Schema + Seed Data (Drizzle + SQLite)

Parent: [../readme.md](../readme.md)

## Summary

Define the full schema in `db/schema.ts` with Drizzle's `sqliteTable`, generate the SQL migration with `drizzle-kit generate`, write a seed script, and implement the `SqliteXxxRepository` concrete classes. The same `db/schema.ts` is the source of truth reused in [Round 6](../round-6/readme.md) against Postgres per [ADR-012](../../architecture/decisions/012-drizzle-orm.md). **Postgres-specific features (RLS) are NOT used here** — visibility/ownership is enforced at the repository layer per [ADR-007](../../architecture/decisions/007-repository-pattern.md).

## Happy Path

1. Extend `db/schema.ts` with all canonical tables as `sqliteTable` definitions: `profiles`, `exercises`, `routines`, `routine_days`, `routine_exercises`, `workouts`, `workout_entries`, `progress_photos`. Use Drizzle's `text({ enum: [...] })` for `routine_type` / `weight_unit` / `status`; use `integer({ mode: 'timestamp' })` for timestamps; use foreign-key helpers with `references(() => ...)`.
2. Run `npm run db:generate` to produce `db/migrations/0001_<name>.sql`. **Commit the generated file.**
3. Run `npm run db:migrate` to apply it against `local.db`.
4. Author `db/seed.ts` (or `db/seeds/0001_seed.ts`) with: 32 exercises, 2 routines, 10 routine days, routine exercises for both routines. Use Drizzle's `db.insert(table).values(...)` (not raw SQL) so the seed exercises the same client the repos use.
5. Add an npm script `db:seed` and run it; verify all seed rows exist.
6. Implement each `SqliteXxxRepository` against the abstract `XxxRepository` from [ADR-007](../../architecture/decisions/007-repository-pattern.md):
   - `SqliteProfileRepository`
   - `SqliteRoutineRepository`
   - `SqliteWorkoutRepository`
   - `SqlitePhotoRepository`
   Each consumes the Drizzle `db` instance and returns Drizzle-inferred row types.
7. In every `SqliteXxxRepository` that touches user-owned rows, add explicit guards (`eq(table.userId, currentUserId)`, `and(...)`, etc.) for visibility per [ADR-004](../../architecture/decisions/004-rls-visibility.md) and photo ownership per [ADR-005](../../architecture/decisions/005-private-photos.md).
8. Photo blobs live on the local filesystem at `./uploads/photos/{user_id}/{timestamp}.jpg`; the `progress_photos` row stores the relative path. A Supabase Storage swap happens in Round 6.
9. Smoke test that creates a profile, a routine, a workout, a workout entry, and a progress photo through the repositories (not raw SQL) and reads them back.

## Acceptance Criteria

- AC-1.2-01: `db/schema.ts` defines every canonical table per [database-schema.md](../../architecture/database-schema.md) using Drizzle's `sqliteTable`. Column names, nullability, and FKs match.
- AC-1.2-02: `npm run db:generate` produces a versioned SQL file under `db/migrations/` that, when applied, creates all tables and indexes per [database-schema.md](../../architecture/database-schema.md).
- AC-1.2-03: `npm run db:seed` populates the canonical seed data per [ADR-003](../../architecture/decisions/003-routines-seed-data.md) using Drizzle's typed client.
- AC-1.2-04: `SqliteXxxRepository` classes enforce write-own / read-all visibility at the repository layer (no leaks across users) per [ADR-004](../../architecture/decisions/004-rls-visibility.md). Unit tests cover a non-owner rejection case for at least `WorkoutRepository` and `PhotoRepository`.
- AC-1.2-05: `SqlitePhotoRepository` enforces owner-only access per [ADR-005](../../architecture/decisions/005-private-photos.md).
- AC-1.2-06: Weight is stored in kg per [ADR-006](../../architecture/decisions/006-kg-storage.md); display unit conversion happens at the UI layer.
- AC-1.2-07: The schema is expressed in Drizzle in a way that can be re-exported as `pgTable` in Round 6 (table names, column names, and types are portable; only the import path and a few column types change) per [ADR-012](../../architecture/decisions/012-drizzle-orm.md).

## Tasks

- [x] `T1.2-01` - Define all canonical tables in `db/schema.ts` with `sqliteTable`
- [x] `T1.2-02` - Run `drizzle-kit generate` and commit the SQL migration
- [x] `T1.2-03` - Run `drizzle-kit migrate` against `local.db`
- [x] `T1.2-04` - Author `db/seed.ts` using Drizzle's typed `db.insert(...)` (32 exercises, 2 routines, 10 days, routine exercises)
- [x] `T1.2-05` - Add `db:seed` npm script and run it
- [x] `T1.2-06` - Implement `SqliteProfileRepository`
- [x] `T1.2-07` - Implement `SqliteRoutineRepository`
- [x] `T1.2-08` - Implement `SqliteWorkoutRepository`
- [x] `T1.2-09` - Implement `SqlitePhotoRepository` (local filesystem)
- [x] `T1.2-10` - Add repository-level visibility/ownership guards in every `SqliteXxxRepository`
- [x] `T1.2-11` - Unit tests: non-owner cannot read/write another user's workout or photo
- [x] `T1.2-12` - Smoke test: end-to-end create → read through repositories

## Implementation Evidence

**Files created:**
- `db/schema.ts` — 9 `sqliteTable` definitions: `profiles, exercises, routines, routine_days, routine_exercises, workouts, workout_entries, progress_photos, sessions`. Column names, nullability, and FKs match `docs/architecture/database-schema.md`.
- `db/migrations/0000_flowery_blink.sql` (initial), `0001_demonic_mordo.sql` (auth tables), `0002_auth_sessions.sql`, `0003_add_email_password_to_profiles.sql`
- `db/seed.ts` — seed script using Drizzle's typed `db.insert()` (32 exercises, routines, routine days)
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts` (owner-level visibility guards)
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository.ts` (read-all, write-own)
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository.ts` (owner-level visibility guards)
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository.ts` (owner-only, local filesystem)
- `tests/workout-tracking/sqlite-profile.repository.test.ts` (visibility tests)
- `tests/workout-tracking/sqlite-workout.repository.test.ts` (visibility tests)
- `tests/workout-tracking/sqlite-photo.repository.test.ts` (owner-only tests)
- `tests/workout-tracking/cascade.test.ts` (orphan cleanup validation)
- `tests/workout-tracking/smoke.test.ts` (end-to-end create → read through repositories)
- `tests/workout-tracking/test-db.ts` (in-memory SQLite test helper)

**Verification:**
- `npm run db:seed` populates canonical seed data ✅
- `npm run test:run` — 54/54 tests pass ✅ (at time of story-1.4 completion)
- Visibility/ownership guards: `cascade.test.ts` confirms orphan cleanup works ✅
- Weight stored in `kg` (real column, no conversion at DB layer) ✅
