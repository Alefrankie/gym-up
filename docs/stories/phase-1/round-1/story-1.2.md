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
  architecture_decisions: ["ADR-003", "ADR-004", "ADR-005", "ADR-006"]
  flows: []
blocked_by: ["story-1.1"]
blocks: ["story-1.3", "story-2.1"]
---

# Story 1.2 — Database Schema + Seed Data

Parent: [../readme.md](../readme.md)

## Summary

Create Supabase migration with all tables, RLS policies, seed data, and storage bucket.

## Happy Path

1. Create `supabase/migrations/001_initial_schema.sql`.
2. Run migration in Supabase SQL Editor.
3. Verify tables exist: profiles, exercises, routines, routine_days, routine_exercises, workouts, workout_entries, progress_photos.
4. Verify seed data: 32 exercises, 2 routines, 10 routine days, routine exercises for both routines.
5. Verify RLS policies active on all tables.
6. Verify storage bucket `progress-photos` exists (private).

## Acceptance Criteria

- AC-1.2-01: All tables created per [database-schema.md](../../architecture/database-schema.md).
- AC-1.2-02: Seed data populated for exercises and routines per [ADR-003](../../architecture/decisions/003-routines-seed-data.md).
- AC-1.2-03: RLS policies enforce write-own-read-all per [ADR-004](../../architecture/decisions/004-rls-visibility.md).
- AC-1.2-04: Photos table has owner-only RLS per [ADR-005](../../architecture/decisions/005-private-photos.md).
- AC-1.2-05: Storage bucket exists with RLS per [upload-photo.flow.md](../../architecture/contexts/private-photos/flows/upload-photo.flow.md).

## Tasks

- [ ] `T1.2-01` - Create migration SQL file
- [ ] `T1.2-02` - Run migration in Supabase
- [ ] `T1.2-03` - Verify tables and seed data
- [ ] `T1.2-04` - Verify RLS policies
- [ ] `T1.2-05` - Create storage bucket
