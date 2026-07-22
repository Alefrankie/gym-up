---
story_id: "2.1"
round: "round-2"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-005", "FR-WT-007", "FR-WT-014", "FR-WT-015"]
  architecture_decisions: ["ADR-003"]
  flows: ["start-workout.flow.md"]
blocked_by: ["story-1.3", "story-1.4"]
blocks: ["story-2.2"]
---

# Story 2.1 — Dashboard (Today's Routine)

Parent: [../readme.md](../readme.md)

## Summary

Dashboard shows today's workout based on weekday. Handles weekends and existing workouts.

## Happy Path

1. User opens `/dashboard`.
2. Page fetches profile (routine_type, weight_unit).
3. Gets current weekday (1-5).
4. Queries `routine_days` for user's routine + today.
5. Fetches `routine_exercises` with exercises.
6. Checks if workout exists for today.
7. Displays exercise list with target sets/reps.
8. Shows cardio reminder.
9. Shows "Start workout" button.

## Acceptance Criteria

- AC-2.1-01: Dashboard shows correct routine for current weekday per [FR-WT-005](../../prd/features/workout-tracking.md).
- AC-2.1-02: Exercises show target sets/reps per [FR-WT-007](../../prd/features/workout-tracking.md).
- AC-2.1-03: Weekend shows rest day with manual picker per [FR-WT-014](../../prd/features/workout-tracking.md).
- AC-2.1-04: Cardio reminder displayed per [FR-WT-015](../../prd/features/workout-tracking.md).
- AC-2.1-05: Existing in-progress workout shows "Continue" per [start-workout.flow.md](../../architecture/contexts/workout-tracking/flows/start-workout.flow.md).

## Tasks

- [ ] `T2.1-01` - Create dashboard page
- [ ] `T2.1-02` - Fetch today's routine
- [ ] `T2.1-03` - Handle weekend/rest day
- [ ] `T2.1-04` - Check existing workout
- [ ] `T2.1-05` - Display exercise list
- [ ] `T2.1-06` - Add cardio reminder
