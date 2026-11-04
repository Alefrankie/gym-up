---
id: DR-0023
title: "Body Metrics Are Owner-Only"
status: accepted
tier: 2
date: 2026-10-01
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: cross-team
reversibility: costly
risk_flags: [privacy]

depends_on: []
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code: []
  issues:
    - "docs/stories/phase-2/readme.md"
  prs: []

validation:
  criteria:
    - "body_measurements is readable and writable by its owner only"
    - "Body metrics never appear in public view, feed, member cards or exports of other users"
  review_by: null
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-023
---
# DR-0023 · Body Metrics Are Owner-Only

## Legacy status

Accepted. Extends the exception list of [ADR-004](./DR-0004-rls-visibility.md) (photos → photos, nutrition, body metrics, readiness).

## Context

Hevy lets users log body weight, body fat and body measurements. They are private to the user and never appear on the profile or feed. Phase 1 already treats photos ([ADR-005](./DR-0005-private-photos.md)) and nutrition as owner-only.

## Decision

1. `body_measurements` is **owner-only** for every operation (select, insert, update, delete), like `progress_photos`.
2. It never appears in public view, the feed, member cards, share images or exports of other users.
3. Measurements follow Hevy's set. Lengths are stored in **cm** and weight in **kg** ([ADR-006](./DR-0006-kg-storage.md)). Display follows `profiles.weight_unit` (kg → cm, lbs → in).
4. The latest body weight is readable by the owner's own contexts through `BodyWeightPort` (e.g. bodyweight-exercise volume, AI summary). It is never exposed cross-user.

## Rationale

- Body weight is more sensitive than training volume. Hevy and every comparable app keep it private.
- It matches the existing photo/nutrition precedent, so there is no new RLS pattern.

## Consequences

- RLS: `body_measurements_{select,insert,update,delete}_own` with `auth.uid() = user_id`.
- `SqliteBodyMeasurementRepository` guards every query with `where user_id = ?` ([ADR-007](./DR-0007-repository-pattern.md)).
- An integration test as a non-owner must fail to read ([story-11.1](../docs/stories/phase-2/round-11/story-11.1.md)).

## Referenced by

- [body-metrics PRD](../docs/prd/features/body-metrics.md)
- [database-schema.md](../docs/architecture/database-schema.md)

## Log

- 2026-10-01 accepted as ADR-023 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/023-body-metrics-privacy.md; status mapped to the code as of today: accepted. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet.
- 2026-11-04 note: Not built on 2026-11-04 (no body_measurements table; only profiles.body_weight_kg exists).
- 2026-11-04 note: Where it mentions Supabase/RLS, DR-0027 supersedes the implementation detail.
