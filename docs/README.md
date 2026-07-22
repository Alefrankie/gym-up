# Gym Up — Architecture & Product Documentation

**Status:** Planning complete, implementation pending
**Last Updated:** 2026-07-21

Gym workout tracking web app. Two predefined routines (male/female), per-user logging, progress charts, public family visibility, private progress photos, AI nutrition analysis.

**Stack:** Astro + Supabase + Vercel. Email/password auth. RLS-enforced data isolation.

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

---

## 2. Architecture ([architecture/](./architecture/))

How the system is shaped, how data moves, where state lives.

- [architecture/readme.md](./architecture/readme.md) — section index
- [architecture/system.md](./architecture/system.md) — topology, rendering strategy, stack
- [architecture/database-schema.md](./architecture/database-schema.md) — PostgreSQL DDL, seed data, RLS
- [architecture/components.md](./architecture/components.md) — UI component specs
- [glossary.md](./glossary.md) — domain terms
- **Decisions — [architecture/decisions/](./architecture/decisions/)**
  - [architecture/decisions/readme.md](./architecture/decisions/readme.md) — ADR index
  - ADR-001 through ADR-006
- **Contexts — [architecture/contexts/](./architecture/contexts/)**
  - [architecture/contexts/readme.md](./architecture/contexts/readme.md) — context specs by feature

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
