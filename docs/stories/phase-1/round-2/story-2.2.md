---
story_id: "2.2"
round: "round-2"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-006"]
  architecture_decisions: []
  flows: ["start-workout.flow.md"]
blocked_by: ["story-2.1"]
blocks: ["story-2.3"]
---

# Story 2.2 — Start Workout

Parent: [../readme.md](../readme.md)

## Summary

User taps "Start workout" → creates workout record → redirects to workout page.

## Happy Path

1. User taps "Start workout" on dashboard.
2. Client inserts `workouts` record: user_id, routine_day_id, workout_date, status='in_progress'.
3. Redirect to `/workout/[workout_id]`.

## Acceptance Criteria

- AC-2.2-01: Workout record created per [FR-WT-006](../../prd/features/workout-tracking.md).
- AC-2.2-02: Redirect to workout page per [start-workout.flow.md](../../architecture/contexts/workout-tracking/flows/start-workout.flow.md).

## Tasks

- [ ] `T2.2-01` - Create workout insert logic
- [ ] `T2.2-02` - Create workout page route
- [ ] `T2.2-03` - Handle redirect
