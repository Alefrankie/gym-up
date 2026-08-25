---
story_id: "6.1"
round: "round-6"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "completed"
started: "2026-08-25"
completed: "2026-08-25"
owner: "crew-flow"
implements:
  architecture_features: ["workout-tracking"]
  architecture_decisions: ["ADR-001", "ADR-003", "ADR-004", "ADR-005", "ADR-006", "ADR-007"]
  flows: []
blocked_by: ["story-1.1", "story-1.2", "story-1.3", "story-5.3"]
blocks: ["story-6.2", "story-6.3"]
---

# Story 6.1 — Supabase Project + Env + Postgres Schema

Parent: [../readme.md](../readme.md)

## Summary

Provision the Supabase project, wire env vars, and port the SQLite DDL to a Postgres migration. Tables and seed data are produced here; RLS, repositories, and Auth are added in stories 6.2 and 6.3.

## Happy Path

1. Create the Supabase project (production + a separate one for preview).
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to `.env.example`, Vercel project env, and local `.env`.
3. Add `STORAGE_BACKEND=supabase` to the deploy env (default in `.env.example` stays `sqlite` for dev).
4. Author `supabase/migrations/001_initial_schema.sql` from the canonical [database-schema.md](../../architecture/database-schema.md), with these adjustments vs. the Round-1 SQLite version:
   - `TEXT` → `uuid` for FK columns.
   - `INTEGER PRIMARY KEY` → `uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
   - `DATETIME` → `timestamptz`.
   - Add the trigger that creates a `profiles` row from `auth.users` INSERT (carried over from the original Round-1 design).
5. Author `supabase/seed.sql` with the same 32 exercises, 2 routines, 10 routine days, routine exercises (port from the Round-1 seed script).
6. Run migration + seed via `supabase db push` (or SQL Editor).
7. Verify all tables, seed rows, and the `auth.users` → `profiles` trigger exist.

## Acceptance Criteria

- AC-6.1-01: Supabase project provisioned; `SUPABASE_URL` and `SUPABASE_ANON_KEY` are documented in `.env.example`.
- AC-6.1-02: Postgres migration creates all tables from [database-schema.md](../../architecture/database-schema.md).
- AC-6.1-03: Seed data populated identically to the Round-1 SQLite seed per [ADR-003](../../architecture/decisions/003-routines-seed-data.md).
- AC-6.1-04: `INSERT INTO auth.users` trigger creates a matching `profiles` row from metadata (`display_name`, `routine_type`, `weight_unit`).
- AC-6.1-05: `STORAGE_BACKEND` env var is read by the composition root and defaults to `sqlite`; `supabase` selects Supabase implementations (no concrete class is wired in this story — the wiring lands in 6.2/6.3).
- AC-6.1-06: The Postgres DDL lives in `supabase/migrations/` and is the single source of truth for the production schema.

## Tasks

- [x] `T6.1-01` - Provision Supabase project (prod + preview)
- [x] `T6.1-02` - Add env vars to `.env.example` and Vercel
- [x] `T6.1-03` - Add `STORAGE_BACKEND` config reader
- [x] `T6.1-04` - Author `supabase/migrations/001_initial_schema.sql` (Postgres DDL)
- [x] `T6.1-05` - Add `auth.users` → `profiles` trigger with metadata mapping
- [x] `T6.1-06` - Port seed data to `supabase/seed.sql`
- [x] `T6.1-07` - Run migration + seed against the Supabase project
- [x] `T6.1-08` - Verify tables, seed rows, and trigger
