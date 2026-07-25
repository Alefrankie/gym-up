---
story_id: "4.1"
round: "round-4"
parent_spec: "../../architecture/contexts/public-view/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["public-view"]
  prd_requirements: ["FR-PV-001", "FR-PV-002", "FR-PV-003", "FR-PV-005", "FR-PV-006"]
  architecture_decisions: ["ADR-004"]
  flows: ["view-family.flow.md"]
blocked_by: ["story-3.3"]
blocks: ["story-4.2"]
---

# Story 4.1 — Family View

Parent: [../readme.md](../readme.md)

## Summary

Family page shows all members with stats. Tap to view member progress. Reads through the local `ProfileRepository` / `WorkoutRepository` — no Supabase.

## Happy Path

1. User opens `/family`.
2. Fetches all profiles.
3. Computes stats per profile.
4. Renders `family-member-card` list.
5. Tap member → `/family/[user_id]` (read-only progress).

## Acceptance Criteria

- AC-4.1-01: All profiles visible per [FR-PV-001](../../prd/features/public-view.md).
- AC-4.1-02: Stats displayed per [FR-PV-005](../../prd/features/public-view.md).
- AC-4.1-03: Member view read-only per [FR-PV-006](../../prd/features/public-view.md).
- AC-4.1-04: Photos not visible per [FR-PV-004](../../prd/features/public-view.md).

## Tasks

- [ ] `T4.1-01` - Create family page
- [ ] `T4.1-02` - Create `src/components/family-member-card.astro`
- [ ] `T4.1-03` - Compute member stats
- [ ] `T4.1-04` - Create member profile page
