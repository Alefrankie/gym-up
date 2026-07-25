---
story_id: "1.1"
round: "round-1"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-001"]
  architecture_decisions: ["ADR-007", "ADR-010", "ADR-012"]
  flows: []
blocked_by: []
blocks: ["story-1.2", "story-1.3"]
---

# Story 1.1 — Project Scaffold (Astro + Drizzle + SQLite)

Parent: [../readme.md](../readme.md)

## Summary

Setup Astro project with **Drizzle ORM** over a local SQLite file and Vercel deployment config. **No Supabase in this story** — Supabase integration is deferred to [Round 6](../round-6/readme.md). The Drizzle schema is the single source of truth for the canonical tables and is reused in Round 6 against Postgres per [ADR-012](../../architecture/decisions/012-drizzle-orm.md).

## Happy Path

1. Create Astro project with `@astrojs/vercel` adapter.
2. Install dependencies:
   - `drizzle-orm` (runtime)
   - `drizzle-kit` (CLI: `generate`, `migrate`)
   - `better-sqlite3` (SQLite driver)
   - `@types/better-sqlite3` (dev)
3. Create `.env` with `DATABASE_URL=file:./local.db`.
4. Create `drizzle.config.ts` at the project root, configured for SQLite (dialect flag, schema path, migrations folder, `dbCredentials.url` from `DATABASE_URL`).
5. Create `db/schema.ts` exporting at least one `sqliteTable` (e.g. `profiles`) and infer its type via `InferSelectModel` / `InferInsertModel` as proof.
6. Create `src/lib/db/client.ts` exporting a `db` instance built with `drizzle(new Database(env.DATABASE_URL), { schema })`. Single instance per process; reused everywhere.
7. Create `src/lib/repositories/` with the abstract `XxxRepository` base classes per [ADR-007](../../architecture/decisions/007-repository-pattern.md).
8. Create the first `SqliteXxxRepository` concrete implementation (e.g. `SqliteProfileRepository`) using the Drizzle `db` client. It compiles, the schema type flows end-to-end.
9. Wire the composition root per [ADR-010](../../architecture/decisions/010-per-context-composition.md) (e.g. `src/lib/composition/workout.ts`) selecting `SqliteXxxRepository` based on `STORAGE_BACKEND=sqlite`.
10. Create `src/layouts/layout.astro` (kebab-case per [components.md](../../architecture/components.md#conventions)) and `src/pages/index.astro`.
11. Add npm scripts: `db:generate` (`drizzle-kit generate`), `db:migrate` (`drizzle-kit migrate`), `db:studio` (`drizzle-kit studio`).
12. Verify `npm run dev` boots Astro, `db:migrate` creates `local.db` with the first table, and the landing page renders.

## Acceptance Criteria

- AC-1.1-01: Astro project boots with `npm run dev`.
- AC-1.1-02: `drizzle-kit generate` produces a versioned SQL file under `db/migrations/` from `db/schema.ts`.
- AC-1.1-03: `drizzle-kit migrate` applies that file to `local.db` without error; the `profiles` table exists.
- AC-1.1-04: `src/lib/db/client.ts` exports a typed `db` instance; downstream code gets autocomplete on table names and columns.
- AC-1.1-05: Abstract `XxxRepository` classes are defined in `src/lib/repositories/` per [ADR-007](../../architecture/decisions/007-repository-pattern.md).
- AC-1.1-06: At least one `SqliteXxxRepository` concrete class compiles and is wired via the per-context composition root per [ADR-010](../../architecture/decisions/010-per-context-composition.md).
- AC-1.1-07: Landing page renders at `/`.
- AC-1.1-08: Project is structured so the same `db/schema.ts` (or a parallel `pgTable` version) can be reused in [Round 6](../round-6/readme.md) against Postgres by swapping only the driver, per [ADR-012](../../architecture/decisions/012-drizzle-orm.md).

## Tasks

- [ ] `T1.1-01` - Create Astro project with vercel adapter
- [ ] `T1.1-02` - Install `drizzle-orm`, `drizzle-kit`, `better-sqlite3`, `@types/better-sqlite3`
- [ ] `T1.1-03` - Add `DATABASE_URL=file:./local.db` to `.env.example` and local `.env`
- [ ] `T1.1-04` - Create `drizzle.config.ts` (dialect: `sqlite`)
- [ ] `T1.1-05` - Create `db/schema.ts` with at least one `sqliteTable` (proof: `profiles`)
- [ ] `T1.1-06` - Create `src/lib/db/client.ts` with a typed Drizzle `db` instance
- [ ] `T1.1-07` - Define abstract `XxxRepository` base classes in `src/lib/repositories/` (ADR-007)
- [ ] `T1.1-08` - Create first `SqliteXxxRepository` concrete impl (e.g. `SqliteProfileRepository`)
- [ ] `T1.1-09` - Wire per-context composition root (ADR-010) selecting on `STORAGE_BACKEND`
- [ ] `T1.1-10` - Add npm scripts: `db:generate`, `db:migrate`, `db:studio`
- [ ] `T1.1-11` - Create `src/layouts/layout.astro` and `src/pages/index.astro`
- [ ] `T1.1-12` - Verify `npm run dev` boots and `db:migrate` creates `local.db`
