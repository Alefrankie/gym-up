---
id: DR-0003
title: "Routines as Seed Data"
status: superseded
tier: 1
date: 2026-07-21
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: local
reversibility: costly
risk_flags: [data]

depends_on: []
supersedes: []
superseded_by: DR-0018
conflicts_with: []

links:
  code: []
  issues: []
  prs: []

validation:
  criteria: []
  review_by: null
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-003
---
# DR-0003 · Routines as Seed Data

## Legacy status

Superseded by [ADR-018](./DR-0018-user-owned-programs.md) (2026-10-01)

## Context

Routines are fixed and predefined. Store in DB or hardcode?

## Decision

Store in database as seed data via SQL migration.

## Rationale

- Editable via Supabase dashboard without code changes
- Frontend stays thinner
- Same pattern for reading routines and user workouts

## Consequences

- `001_initial_schema.sql` includes all seed data
- No admin UI (not needed for family use)

## Referenced by

- [workout-tracking](../docs/prd/features/workout-tracking.md)
- [database-schema](../docs/architecture/database-schema.md)

## Log

- 2026-07-21 superseded as ADR-003 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/003-routines-seed-data.md; status mapped to the code as of today: superseded. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria left empty: superseded before any criteria were recorded.
- 2026-11-04 T1: no validation.criteria required.
