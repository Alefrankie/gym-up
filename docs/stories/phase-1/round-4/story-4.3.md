---
story_id: "4.3"
round: "round-4"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "completed"
started: "2026-08-11"
completed: "2026-08-11"
owner: "Copilot"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-016", "FR-WT-017"]
  architecture_decisions: ["ADR-006"]
  flows: []
blocked_by: ["story-4.2"]
blocks: []
---

# Story 4.3 — Settings Page

Parent: [../readme.md](../readme.md)

## Summary

Settings page for profile name, routine type, weight unit, and logout.

## Happy Path

1. User opens `/settings`.
2. Fetches current profile.
3. Shows: display name, routine type (radio), weight unit (radio).
4. User changes + saves.
5. Logout button at bottom.

## Acceptance Criteria

- AC-4.3-01: Can update display name per [FR-WT-016](../../prd/features/workout-tracking.md).
- AC-4.3-02: Can switch routine type per [FR-WT-016](../../prd/features/workout-tracking.md).
- AC-4.3-03: Can toggle weight unit per [FR-WT-016](../../prd/features/workout-tracking.md) and [ADR-006](../../architecture/decisions/006-kg-storage.md).
- AC-4.3-04: Logout works per [FR-WT-017](../../prd/features/workout-tracking.md).

## Tasks

- [x] `T4.3-01` - Create settings page
- [x] `T4.3-02` - Add form fields
- [x] `T4.3-03` - Add save logic
- [x] `T4.3-04` - Add logout
