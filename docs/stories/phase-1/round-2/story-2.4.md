---
story_id: "2.4"
round: "round-2"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-008", "FR-WT-013"]
  architecture_decisions: []
  flows: ["log-set.flow.md"]
blocked_by: ["story-2.3"]
blocks: ["story-2.5", "story-2.6"]
---

# Story 2.4 — Log Set (Auto-Save)

Parent: [../readme.md](../readme.md)

## Summary

Auto-save workout entries on input change with debounce.

## Happy Path

1. User fills reps + weight for a set.
2. Taps checkmark → marks completed.
3. Client debounces (500ms) then inserts `workout_entries` row.
4. Weight converted to kg if user on lbs.
5. Partial saves work (resume later).

## Acceptance Criteria

- AC-2.4-01: Entry saved to DB per [log-set.flow.md](../../architecture/contexts/workout-tracking/flows/log-set.flow.md).
- AC-2.4-02: Partial workouts resumable per [FR-WT-013](../../prd/features/workout-tracking.md).

## Tasks

- [ ] `T2.4-01` - Add auto-save logic with debounce
- [ ] `T2.4-02` - Handle kg conversion
- [ ] `T2.4-03` - Load existing entries on resume
