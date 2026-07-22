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
  architecture_decisions: ["ADR-001"]
  flows: []
blocked_by: []
blocks: ["story-1.2", "story-1.3"]
---

# Story 1.1 — Project Scaffold

Parent: [../readme.md](../readme.md)

## Summary

Setup Astro project with Supabase integration and Vercel deployment config.

## Happy Path

1. Create Astro project with `@astrojs/vercel` adapter.
2. Install `@supabase/supabase-js`.
3. Create `.env` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. Create `src/lib/supabase.ts` client initialization.
5. Create basic `src/layouts/Layout.astro`.
6. Create landing page `src/pages/index.astro`.
7. Verify `npm run dev` works locally.

## Acceptance Criteria

- AC-1.1-01: Astro project boots with `npm run dev` per [ADR-001](../../architecture/decisions/001-supabase-client-side.md).
- AC-1.1-02: Supabase client initializes without error.
- AC-1.1-03: Landing page renders at `/`.

## Tasks

- [ ] `T1.1-01` - Create Astro project with vercel adapter
- [ ] `T1.1-02` - Install supabase-js dependency
- [ ] `T1.1-03` - Create supabase client lib
- [ ] `T1.1-04` - Create base layout
- [ ] `T1.1-05` - Create landing page
