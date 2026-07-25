---
story_id: "2.5"
round: "round-2"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-011"]
  architecture_decisions: ["ADR-002"]
  flows: ["log-set.flow.md"]
blocked_by: ["story-2.4"]
blocks: ["story-2.6"]
---

# Story 2.5 — Rest Timer

Parent: [../readme.md](../readme.md)

## Summary

Rest timer React island between sets.

## Happy Path

1. User taps checkmark on a set.
2. `rest-timer` component appears (90s countdown).
3. User can +30s or skip.
4. Timer reaches 0 → auto-hide.

## Acceptance Criteria

- AC-2.5-01: Timer starts on set completion per [FR-WT-011](../../prd/features/workout-tracking.md).
- AC-2.5-02: Client-side only, no DB persistence per [components.md](../../architecture/components.md).

## Tasks

- [ ] `T2.5-01` - Create `src/components/rest-timer.tsx` React island
- [ ] `T2.5-02` - Wire to checkmark tap
- [ ] `T2.5-03` - Add +30s and skip
