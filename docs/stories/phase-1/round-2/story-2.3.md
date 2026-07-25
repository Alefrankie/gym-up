---
story_id: "2.3"
round: "round-2"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-008", "FR-WT-009", "FR-WT-010"]
  architecture_decisions: ["ADR-006"]
  flows: ["log-set.flow.md"]
blocked_by: ["story-2.2"]
blocks: ["story-2.4"]
---

# Story 2.3 — `exercise-card`

Parent: [../readme.md](../readme.md)

## Summary

`exercise-card` component for logging sets with reps, weight, notes.

## Happy Path

1. Workout page renders `exercise-card` per exercise.
2. Pre-populated with target sets count.
3. Each set: reps input, weight input (with unit label), checkmark.
4. Notes field (optional).
5. "+ Add set" button for extra sets.

## Acceptance Criteria

- AC-2.3-01: Card shows exercise name + target per [FR-WT-008](../../prd/features/workout-tracking.md).
- AC-2.3-02: Weight shows unit label per [FR-WT-009](../../prd/features/workout-tracking.md) and [ADR-006](../../architecture/decisions/006-kg-storage.md).
- AC-2.3-03: Notes field optional per [FR-WT-010](../../prd/features/workout-tracking.md).

## Tasks

- [ ] `T2.3-01` - Create `src/components/exercise-card.astro`
- [ ] `T2.3-02` - Add set input rows
- [ ] `T2.3-03` - Add unit label
- [ ] `T2.3-04` - Add notes field
- [ ] `T2.3-05` - Add "+ Add set" button
