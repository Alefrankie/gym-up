---
story_id: "3.2"
round: "round-3"
parent_spec: "../../architecture/contexts/progress/readme.md"
size: "L"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progress"]
  prd_requirements: ["FR-PR-002", "FR-PR-003", "FR-PR-004", "FR-PR-005"]
  architecture_decisions: ["ADR-002", "ADR-006"]
  flows: ["view-progress.flow.md"]
blocked_by: ["story-3.1"]
blocks: ["story-3.3"]
---

# Story 3.2 — Progress Charts

Parent: [../readme.md](../readme.md)

## Summary

Exercise-specific charts with Chart.js React island.

## Happy Path

1. User opens `/progress`.
2. Exercise selector dropdown populated.
3. User selects exercise.
4. Line chart shows weight over time.
5. Bar chart shows volume over time.
6. Date range filter: 7d, 30d, all.
7. Weight in user's preferred unit.

## Acceptance Criteria

- AC-3.2-01: Charts render per [FR-PR-002](../../prd/features/progress.md) and [ADR-002](../../architecture/decisions/002-chartjs-react-island.md).
- AC-3.2-02: Date filter works per [FR-PR-003](../../prd/features/progress.md).
- AC-3.2-03: Unit display correct per [FR-PR-005](../../prd/features/progress.md) and [ADR-006](../../architecture/decisions/006-kg-storage.md).

## Tasks

- [ ] `T3.2-01` - Create progress page
- [ ] `T3.2-02` - Create `src/components/progress-chart.tsx` React island
- [ ] `T3.2-03` - Add exercise selector
- [ ] `T3.2-04` - Add date range filter
- [ ] `T3.2-05` - Handle unit display
