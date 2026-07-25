---
story_id: "2.6"
round: "round-2"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-012"]
  architecture_decisions: []
  flows: ["log-set.flow.md"]
blocked_by: ["story-2.4", "story-2.5"]
blocks: ["story-3.1"]
---

# Story 2.6 — Complete Workout + Summary

Parent: [../readme.md](../readme.md)

## Summary

User finishes workout → summary displayed → status updated.

## Happy Path

1. User taps "Finish workout".
2. Client validates ≥1 entry exists.
3. Updates `workouts.status = 'completed'`, sets `completed_at`.
4. Redirects to summary view.
5. Summary shows: exercises, sets, volume, duration.

## Acceptance Criteria

- AC-2.6-01: Workout marked completed per [FR-WT-012](../../prd/features/workout-tracking.md).
- AC-2.6-02: Summary displayed per [log-set.flow.md](../../architecture/contexts/workout-tracking/flows/log-set.flow.md).

## Tasks

- [ ] `T2.6-01` - Add finish button + validation
- [ ] `T2.6-02` - Update workout status
- [ ] `T2.6-03` - Create `src/components/workout-summary.astro`
- [ ] `T2.6-04` - Calculate volume + duration
