---
id: DR-0004
title: "RLS — write own, read all"
status: implemented
tier: 3
date: 2026-07-21
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: system
reversibility: costly
risk_flags: [security, privacy]

depends_on: []
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/api/src/lib/contexts/public-view/"
    - "apps/api/src/nest/common/auth.guard.ts"
  issues: []
  prs: []

validation:
  criteria:
    - "A user cannot create, update or delete another user's data through the API"
    - "Any signed-in user can read other users' workouts and stats"
    - "Progress photos are never readable by anyone but their owner"
  review_by: 2027-02-04
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-004
---
# DR-0004 · RLS — write own, read all

## Legacy status

Accepted

## Context

Multi-user app. Each user has own workouts, but family wants to see everyone's progress.

## Decision

- **Write**: Users can only write their own data
- **Read**: All users can read everyone's data
- **Exception**: Photos are private (owner-only)

## Rationale

- Core family feature is seeing others' progress
- RLS supports this natively
- Photos are the only sensitive data

## Consequences

- `workouts`, `workout_entries`, `profiles`: `FOR SELECT USING (true)`
- `progress_photos`: owner-only

## Referenced by

- [public-view](../docs/prd/features/public-view.md)
- [database-schema](../docs/architecture/database-schema.md)

## Log

- 2026-07-21 accepted as ADR-004 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/004-rls-visibility.md; status mapped to the code as of today: implemented. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet. review_by 2027-02-04 set at migration as a placeholder deadline.
- 2026-11-04 note: Postgres RLS no longer exists: since DR-0027 the same policy (write own, read all, photos private) is enforced by ownership checks in the NestJS API.
