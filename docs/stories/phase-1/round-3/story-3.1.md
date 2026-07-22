---
story_id: "3.1"
round: "round-3"
parent_spec: "../../architecture/contexts/progress/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progress"]
  prd_requirements: ["FR-PR-001"]
  architecture_decisions: []
  flows: ["view-progress.flow.md"]
blocked_by: ["story-2.6"]
blocks: ["story-3.2"]
---

# Story 3.1 — Workout History Page

Parent: [../readme.md](../readme.md)

## Summary

Chronological list of all user workouts with expandable detail.

## Happy Path

1. User opens `/history`.
2. Fetches all workouts ordered by date DESC.
3. Each entry: date, routine day, exercises, volume.
4. Paginated (20/page).
5. Tap entry → expand for full set detail.

## Acceptance Criteria

- AC-3.1-01: History shows all workouts per [FR-PR-001](../../prd/features/progress.md).
- AC-3.1-02: Paginated at 20 per page.

## Tasks

- [ ] `T3.1-01` - Create history page
- [ ] `T3.1-02` - Fetch workouts with entries
- [ ] `T3.1-03` - Add pagination
- [ ] `T3.1-04` - Add expandable detail
