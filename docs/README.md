# Gym Up — Architecture & Product Documentation

**Status:** Phase 1 implemented (Rounds 1–6). Phase 2 (Hevy + Gravl parity) fully specified, implementation pending.
**Last Updated:** 2026-10-01

Gym workout tracking web app. Phase 1: two predefined routines (male/female), per-user logging, progress charts, public family visibility, private progress photos, AI nutrition analysis. Phase 2: exercise library, routine builder, Hevy-grade live workout, personal records, progression coaching, body metrics, statistics, family feed, offline PWA — see [stories/phase-2](./stories/phase-2/readme.md).

**Stack:** NestJS API on Cloudflare Workers (D1, R2) + SvelteKit static SPA + Tauri 2 (Android), in a pnpm/Turborepo monorepo. Email/password auth with a bearer session token; data isolation is enforced in the API (ownership checks per use case). See [ADR-027](architecture/decisions/027-mobile-architecture-nestjs-sveltekit-tauri.md) and the [mobile migration plan](planning/mobile-migration-plan.md). The Phase 2 documents below were written against the earlier Astro + Supabase stack: their product behavior stands, their implementation notes (islands, Supabase, service worker) are superseded by ADR-027.

This index is the single entry point. Every other document is reachable from here in ≤ 2 clicks. Cross-references between documents use relative links; no content is duplicated — each fact lives in exactly one file.

---

## 1. Product Requirements ([prd/](./prd/))

Business intent, who we build for, what we build.

- [prd/readme.md](./prd/readme.md) — section index
- [prd/overview.md](./prd/overview.md) — vision, scope, success criteria
- [prd/personas.md](./prd/personas.md) — user types and needs
- **Features — [prd/features/](./prd/features/)**
  - [prd/features/readme.md](./prd/features/readme.md) — feature index
  - [prd/features/requirements-index.md](./prd/features/requirements-index.md) — FR/NFR ID registry
  - [workout-tracking](./prd/features/workout-tracking.md) — core workout loop
  - [progress](./prd/features/progress.md) — charts, history, streaks
  - [public-view](./prd/features/public-view.md) — family visibility (read-only)
  - [private-photos](./prd/features/private-photos.md) — owner-only progress photos
  - [nutrition](./prd/features/nutrition.md) — photo → AI → calorie estimation
  - **Phase 2:** [exercise-library](./prd/features/exercise-library.md) · [routines](./prd/features/routines.md) · [progression](./prd/features/progression.md) · [body-metrics](./prd/features/body-metrics.md) · [social](./prd/features/social.md)

---

## 2. Architecture ([architecture/](./architecture/))

How the system is shaped, how data moves, where state lives.

**Pattern:** Hexagonal architecture (ports and adapters) organized per feature context. Each context has Domain → Application → Infrastructure → UI layers with a per-context composition file. See [ADR-013](./architecture/decisions/013-hexagonal-architecture.md).

- [architecture/readme.md](./architecture/readme.md) — section index + pattern overview
- [architecture/system.md](./architecture/system.md) — topology, rendering strategy, stack, project structure
- [architecture/database-schema.md](./architecture/database-schema.md) — PostgreSQL DDL, seed data, RLS
- [architecture/components.md](./architecture/components.md) — UI component specs
- [glossary.md](./glossary.md) — domain terms
- **Decisions — [architecture/decisions/](./architecture/decisions/)**
  - [architecture/decisions/readme.md](./architecture/decisions/readme.md) — ADR index
  - ADR-001 through ADR-014 (Phase 1), ADR-015 through ADR-026 (Phase 2)
- **Contexts — [architecture/contexts/](./architecture/contexts/)**
  - [architecture/contexts/readme.md](./architecture/contexts/readme.md) — context specs by feature, layer rules

---

## 3. Planning ([planning/](./planning/))

Phases, open questions, and uncommitted ideas.

- [planning/readme.md](./planning/readme.md) — section index
- [planning/open-questions.md](./planning/open-questions.md) — unresolved decisions
- [planning/proposed-ideas.md](./planning/proposed-ideas.md) — future features backlog

---

## 4. Stories ([stories/](./stories/))

Implementation work units organized by rounds.

- [stories/readme.md](./stories/readme.md) — section index
- [stories/phase-1/](./stories/phase-1/) — Phase 1 rounds
  - [stories/phase-1/readme.md](./stories/phase-1/readme.md) — round index
  - **Round 1** — Foundation (scaffold, schema, auth, nav)
  - **Round 2** — Workout Core (dashboard, start, log, timer, complete)
  - **Round 3** — Progress & History (history, charts, calendar)
  - **Round 4** — Family & Photos (public view, private photos, settings)
  - **Round 5** — Nutrition (AI meal analysis, daily calories)
  - **Round 6** — Supabase integration (deploy)
- [stories/phase-2/](./stories/phase-2/) — **Phase 2: Hevy + Gravl parity**
  - [stories/phase-2/readme.md](./stories/phase-2/readme.md) — rules, all stories, dependency graph, exit criteria
  - **Round 7** — Exercise Library & Data Model v2
  - **Round 8** — Programs & Routines (builder, templates, rotation, onboarding)
  - **Round 9** — Live Workout v2 (Hevy-grade session, navigation, tools)
  - **Round 10** — Progression (PRs, suggestions, plateaus, deloads, readiness)
  - **Round 11** — Body, Stats & Insights (measurements, statistics, photo compare, AI summary)
  - **Round 12** — Social & Platform (feed, share, offline PWA, export, parity E2E)

---

## 5. Implementation Trace ([trace/](./trace/))

Progress tracking and decision log.

- [trace/readme.md](./trace/readme.md) — section index

---

## Conventions

- **Filenames:** all lowercase, kebab-case.
- **One concept per file.** If a file grows beyond ~300 lines, split it.
- **No duplication.** Each fact is stated in exactly one file. Other files link to it.
- **Cross-references are mandatory.** When a feature references architecture or constraints, link instead of restating.
- **Parent/Up breadcrumbs** at top of every file for navigation.
- **Implementation state labels:** `planned`, `implemented`, `blocked`, `decision-needed`.
