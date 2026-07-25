# Phase 1 Rounds

Parent: [../readme.md](../readme.md) · Phase: MVP

## Purpose

Rounds turn Phase 1 decisions into small implementation sub-phases that can be built and tested independently.

---

## ⚠️ Phase Rule — No Supabase until Round 6

> **Rounds 1–5 are developed against a fully local stack. Supabase is not used and must not be imported until [Round 6](./round-6/readme.md).**

What this means in practice:

- **Database**: SQLite file (`local.db`). No Postgres, no `pg`, no RLS. Visibility / ownership rules live in the `SqliteXxxRepository` per [ADR-007](../../architecture/decisions/007-repository-pattern.md).
- **Auth**: local `LocalAuthService` (password hash + httpOnly session cookie + `sessions` table). No `@supabase/supabase-js`.
- **File storage**: local filesystem (e.g. `./uploads/...`). No Supabase Storage buckets, no signed URLs.
- **Env vars**: only `DATABASE_URL=file:./local.db` (and friends for local services). `SUPABASE_URL` / `SUPABASE_ANON_KEY` are not required to boot the app in Rounds 1–5.
- **Why**: zero network, zero credentials, zero quota limits during development. Round 6 is the one-time swap that maps local artifacts to Supabase without touching UI code.

If a story in Rounds 1–5 mentions a Supabase-specific concept (RLS, `auth.users`, signed URLs, `progress-photos` bucket, etc.), it is a bug — fix it before merge.

---

## Round Rule

A round must prove one testable capability. It is not a calendar sprint. It ends when its stories pass acceptance criteria and produce a working behavior.

---

## Story Rule

Each story file should keep this header order when possible:

- `## Summary`
- `## Happy Path`
- `## Acceptance Criteria`
- `## Tasks`
- `## Implementation Evidence` when done

Story files must link to source architecture docs instead of repeating decisions.

---

## Frontmatter Rule

```yaml
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
  flows: ["start-workout.flow.md"]
blocked_by: []
blocks: ["story-1.2"]
---
```

Status values: `draft`, `ready`, `in-progress`, `blocked`, `completed`, `skipped`.

---

## Rounds

### Round 1 - Foundation (Local / SQLite)

Goal: app boots locally with Astro + SQLite, auth works against a local DB. **No network dependencies.** All concrete repositories implement the abstracts from [ADR-007](../../architecture/decisions/007-repository-pattern.md) so they can be swapped for Supabase implementations later.

- [story-1.1.md](./round-1/story-1.1.md) - Project scaffold (Astro + SQLite + Vercel config)
- [story-1.2.md](./round-1/story-1.2.md) - Database schema + seed data (SQLite, repository-level visibility)
- [story-1.3.md](./round-1/story-1.3.md) - Auth (local register + login + sessions)
- [story-1.4.md](./round-1/story-1.4.md) - Navigation + layout shell

### Round 2 - Workout Core

Goal: user can start a workout, log sets, and complete it.

- [story-2.1.md](./round-2/story-2.1.md) - Dashboard (today's routine display)
- [story-2.2.md](./round-2/story-2.2.md) - Start workout (create workout record)
- [story-2.3.md](./round-2/story-2.3.md) - `exercise-card` (sets, reps, weight input)
- [story-2.4.md](./round-2/story-2.4.md) - Log set (auto-save entries)
- [story-2.5.md](./round-2/story-2.5.md) - Rest timer (`rest-timer.tsx`)
- [story-2.6.md](./round-2/story-2.6.md) - Complete workout + summary (`workout-summary.astro`)

### Round 3 - Progress & History

Goal: user can view workout history and exercise progress charts.

- [story-3.1.md](./round-3/story-3.1.md) - Workout history page
- [story-3.2.md](./round-3/story-3.2.md) - Progress charts (`progress-chart.tsx`, Chart.js React island)
- [story-3.3.md](./round-3/story-3.3.md) - Calendar + streaks

### Round 4 - Family & Photos

Goal: family members can view each other's progress. Users can upload private photos.

- [story-4.1.md](./round-4/story-4.1.md) - Family view (list + member profile, `family-member-card.astro`)
- [story-4.2.md](./round-4/story-4.2.md) - Private photos (`photo-upload.astro` + `photo-gallery.astro`)
- [story-4.3.md](./round-4/story-4.3.md) - Settings page (name, routine, unit toggle)

### Round 5 - Nutrition

Goal: user can take a photo of food, AI estimates calories and macros.

- [story-5.1.md](./round-5/story-5.1.md) - AI nutrition analysis endpoint
- [story-5.2.md](./round-5/story-5.2.md) - Meal photo capture + analysis UI
- [story-5.3.md](./round-5/story-5.3.md) - Nutrition history + daily summary

### Round 6 - Supabase Integration (Deploy)

Goal: replace the local SQLite + local auth stack with Supabase (Postgres + Auth + Storage) for production. **No UI changes** — only the concrete repository and auth implementations are swapped at the composition roots defined in [ADR-010](../../architecture/decisions/010-per-context-composition.md).

- [story-6.1.md](./round-6/story-6.1.md) - Supabase project + env + Postgres schema migration
- [story-6.2.md](./round-6/story-6.2.md) - `SupabaseXxxRepository` implementations + RLS
- [story-6.3.md](./round-6/story-6.3.md) - `SupabaseAuthService` + storage bucket

> **Why this round exists:** Rounds 1–5 are developed against a fully local stack so no network, no credentials, and no Supabase project are required to iterate. Round 6 is a one-time swap that maps the SQLite DDL to Postgres, ports the repository guards to RLS, and replaces `LocalAuthService` with `SupabaseAuthService`. The `AuthService` and `XxxRepository` contracts from Round 1 are designed so this swap touches no UI code.
