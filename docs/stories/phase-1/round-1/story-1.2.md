---
story_id: "1.2"
round: "round-1"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
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

- [ ] `T1.2-01` - Define all canonical tables in `db/schema.ts` with `sqliteTable`
- [ ] `T1.2-02` - Run `drizzle-kit generate` and commit the SQL migration
- [ ] `T1.2-03` - Run `drizzle-kit migrate` against `local.db`
- [ ] `T1.2-04` - Author `db/seed.ts` using Drizzle's typed `db.insert(...)` (32 exercises, 2 routines, 10 days, routine exercises)
- [ ] `T1.2-05` - Add `db:seed` npm script and run it
- [ ] `T1.2-06` - Implement `SqliteProfileRepository`
- [ ] `T1.2-07` - Implement `SqliteRoutineRepository`
- [ ] `T1.2-08` - Implement `SqliteWorkoutRepository`
- [ ] `T1.2-09` - Implement `SqlitePhotoRepository` (local filesystem)
- [ ] `T1.2-10` - Add repository-level visibility/ownership guards in every `SqliteXxxRepository`
- [ ] `T1.2-11` - Unit tests: non-owner cannot read/write another user's workout or photo
- [ ] `T1.2-12` - Smoke test: end-to-end create → read through repositories
