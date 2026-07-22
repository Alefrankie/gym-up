---
story_id: "3.3"
round: "round-3"
parent_spec: "../../architecture/contexts/progress/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progress"]
  prd_requirements: ["FR-PR-006", "FR-PR-007"]
  architecture_decisions: []
  flows: ["view-progress.flow.md"]
blocked_by: ["story-3.2"]
blocks: ["story-4.1"]
---

# Story 3.3 — Calendar + Streaks

Parent: [../readme.md](../readme.md)

## Summary

Calendar grid and streak counter on progress page.

## Happy Path

1. Progress page computes last 4 weeks of dates.
2. Marks days with completed workouts.
3. Renders calendar grid with dots.
4. Counts consecutive workout days (streak).
5. Displays streak count + total workouts.

## Acceptance Criteria

- AC-3.3-01: Calendar shows last 4 weeks per [FR-PR-006](../../prd/features/progress.md).
- AC-3.3-02: Streak counter accurate per [FR-PR-007](../../prd/features/progress.md).

## Tasks

- [ ] `T3.3-01` - Add calendar grid component
- [ ] `T3.3-02` - Compute streak
- [ ] `T3.3-03` - Display stats
