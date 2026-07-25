# ADR-012: Drizzle ORM as SQLite/Postgres Abstraction

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

**Status:** Accepted · **Date:** 2026-07-25

## Context

The project needs a typed data layer for two storage backends:

- **Local dev / CI (Rounds 1–5):** SQLite file (`local.db`).
- **Production (Round 6):** Supabase Postgres.

Per [ADR-007](./007-repository-pattern.md) the `XxxRepository` abstract classes are the only surface components touch. The choice below picks the concrete technology that backs those repositories on each side.

Candidates considered:

- **Raw `better-sqlite3` + raw `pg`**: no shared types, two query dialects, two sets of manual migrations.
- **Prisma**: heavy runtime, codegen step, schema is a separate DSL (`schema.prisma`), migrations are opaque, harder to inspect SQL.
- **Kysely**: query builder only, no schema-first migrations, still requires writing SQL by hand.
- **Drizzle ORM**: schema-first in TypeScript, generates portable SQL migrations, same API works against SQLite and Postgres (only the driver import changes), tiny runtime, no codegen step at build.

## Decision

Use **Drizzle ORM** as the data layer for both backends:

- `drizzle-orm` with `better-sqlite3` driver for the local SQLite stack.
- `drizzle-orm` with `postgres-js` (or `pg`) driver for the Supabase stack in [Round 6](../stories/phase-1/round-6/readme.md).
- `drizzle-kit` for schema → migration generation (`drizzle-kit generate`) and applying (`drizzle-kit migrate`).
- The Drizzle schema (`db/schema.ts`) is the **single source of truth** for the canonical tables; it is the input that produces both the SQLite migration in Round 1 and the Postgres migration in Round 6.

## Rationale

- **One schema, two backends.** Drizzle's `sqliteTable` / `pgTable` definitions share the same TypeScript shape; only the import and a few column types differ. Round 6 can reuse the schema with minimal changes.
- **Schema = code.** No codegen at build time, no separate DSL. The TS schema is the contract; the migration SQL is a generated artifact that can be reviewed in PRs.
- **Migrations are plain SQL.** Drizzle Kit emits versioned `.sql` files (e.g. `db/migrations/0000_init.sql`) that the team can read, edit, and apply via standard tools. Round 6's Supabase migration can start from a hand-tuned copy of the same SQL.
- **Type-safety end-to-end.** Repository methods take and return Drizzle-inferred types; no parallel DTOs.
- **Lightweight runtime.** No schema introspection at query time, no shadow DB, no global state. Plays well with Astro SSR + Vercel functions.
- **Fits ADR-007.** The abstract `XxxRepository` is the component-facing contract; the Drizzle-backed implementation lives entirely in `src/lib/repositories/sqlite/`. Components remain agnostic.

## Consequences

- **Drizzle in the dependency graph from Round 1.** The same `drizzle-orm` package is used in both backends; only the driver subpath changes.
- **Migrations are committed.** `db/migrations/*.sql` lives in git; `drizzle-kit generate` is run locally, the output is reviewed and committed.
- **Some Drizzle column types are dialect-specific.** `text({ enum: [...] })` works the same; `integer({ mode: 'timestamp' })` vs `timestamp()` requires care when porting. The port in Round 6 is mechanical but not free.
- **`drizzle.config.ts` is the env bridge.** It carries the dialect flag (`sqlite` ↔ `postgresql`) and the connection string; the choice of `STORAGE_BACKEND` mirrors it.
- **Drivers and clients.** `better-sqlite3` for local, `postgres` (Porsager) preferred over `pg` for Round 6 (smaller, faster, modern API).

## Referenced by

- [ADR-007](./007-repository-pattern.md) — abstract repos; Drizzle is the SQLite implementation
- [Round 1 — Foundation (Local / SQLite)](../stories/phase-1/readme.md)
- [Round 6 — Supabase Integration](../stories/phase-1/round-6/readme.md)
- [database-schema.md](../database-schema.md) — canonical column reference; the Drizzle schema must match
