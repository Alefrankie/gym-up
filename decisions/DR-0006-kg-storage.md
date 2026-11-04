---
id: DR-0006
title: "Store in kg, display per unit"
status: implemented
tier: 3
date: 2026-07-21
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: system
reversibility: costly
risk_flags: [data]

depends_on: []
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/api/db/schema.ts"
  issues: []
  prs: []

validation:
  criteria:
    - "All persisted weights are in kg"
    - "Display converts with the exact factor 0.45359237 according to the user's unit"
  review_by: 2027-02-04
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-006
---
# DR-0006 · Store in kg, display per unit

## Legacy status

Accepted

## Context

Users may prefer kg or lbs. How to store and display?

## Decision

Store all weight in kg internally. `profiles.weight_unit` controls display. Conversion: `lbs = kg / 0.45359237` and `kg = lbs * 0.45359237` (exact definition of the pound; Phase 2 supersedes the `2.20462` approximation used by Phase 1 pages, see [Phase 2 decisions](../docs/stories/phase-2/readme.md#phase-2-decisions-and-resolved-spec-conflicts)). Values are stored unrounded; display rounds.

## Rationale

- Single source of truth avoids inconsistencies
- No data migration if user changes unit
- Conversion is simple math

## Consequences

- `weight_unit` field in `profiles` (default: 'kg')
- Conversion in frontend on display

## Referenced by

- [workout-tracking](../docs/prd/features/workout-tracking.md)
- [progress](../docs/prd/features/progress.md)

## Log

- 2026-07-21 accepted as ADR-006 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/006-kg-storage.md; status mapped to the code as of today: implemented. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet. review_by 2027-02-04 set at migration as a placeholder deadline.
