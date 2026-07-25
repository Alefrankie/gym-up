# Round 6 — Supabase Integration (Deploy)

Parent: [../readme.md](../readme.md) · Phase: 1

## Purpose

Swap the local SQLite stack developed in Rounds 1–5 for the production Supabase stack (Postgres + Auth + Storage). UI, flows, and the `XxxRepository` / `AuthService` contracts do not change — only the concrete implementations and the composition roots.

## Why this round exists

Rounds 1–5 are developed against a local stack so:

- No Supabase project, URL, or anon key is needed during development.
- No network latency or quota limits interfere with tests.
- Schema, repository guards, and auth can be exercised in isolation.

Round 6 is the one-time swap that maps the local artifacts to Supabase:

| Local (Round 1) | Supabase (Round 6) |
|-----------------|---------------------|
| `local.db` file | Supabase Postgres project |
| SQLite DDL | Postgres DDL (via Supabase migration) |
| Repository-level visibility guards | Postgres RLS policies |
| `LocalAuthService` (password hash + cookie) | `SupabaseAuthService` (`@supabase/supabase-js` Auth) |
| Local filesystem photos | Supabase Storage bucket `progress-photos` |
| `SqliteXxxRepository` | `SupabaseXxxRepository` (same contract) |

## Strategy

1. **Same contracts.** `AuthService` and every `XxxRepository` abstract class stay byte-identical. Only the concrete class is swapped at the composition root ([ADR-010](../../architecture/decisions/010-per-context-composition.md)).
2. **One env flag drives the swap.** `STORAGE_BACKEND=sqlite|supabase` selects which concrete is wired. Default in dev is `sqlite`; production uses `supabase`. UI code is unaware of the choice.
3. **Schema port, not rewrite.** The SQLite DDL from Round 1 is the source of truth for tables; Round 6 produces a Postgres-flavored migration that matches the canonical [database-schema.md](../../../architecture/database-schema.md). Postgres-specific bits (RLS, `gen_random_uuid()`, storage policies) are added here.
4. **RLS replaces repo guards.** Where `SqliteXxxRepository` injected `where userId = ?` clauses, `SupabaseXxxRepository` relies on RLS so the same query works for all users and the DB rejects unauthorized rows.
5. **No UI change.** After Round 6 the same `auth-form.astro`, `exercise-card.astro`, `photo-upload.astro`, etc. run unchanged.

## Stories

| ID | Title | Size | Status |
|----|-------|------|--------|
| [story-6.1.md](./story-6.1.md) | Supabase project + env + Postgres schema migration | M | draft |
| [story-6.2.md](./story-6.2.md) | `SupabaseXxxRepository` implementations + RLS | L | draft |
| [story-6.3.md](./story-6.3.md) | `SupabaseAuthService` + storage bucket | M | draft |

## Acceptance Criteria (round-level)

- AC-R6-01: `STORAGE_BACKEND=supabase` boots the app against Supabase with zero UI changes.
- AC-R6-02: `STORAGE_BACKEND=sqlite` still works (regression check for local dev).
- AC-R6-03: RLS policies enforce write-own / read-all per [ADR-004](../../../architecture/decisions/004-rls-visibility.md) verified by integration tests as a non-owner.
- AC-R6-04: Photo access is owner-only per [ADR-005](../../../architecture/decisions/005-private-photos.md) verified by integration test as a non-owner.
- AC-R6-05: Auth is backed by Supabase Auth; session is established via `supabase.auth`; no local `sessions` table is used.
- AC-R6-06: Vercel deploy succeeds with `STORAGE_BACKEND=supabase` and required env vars.
