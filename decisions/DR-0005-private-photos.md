---
id: DR-0005
title: "Private Progress Photos"
status: implemented
tier: 2
date: 2026-07-21
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: cross-team
reversibility: costly
risk_flags: [privacy, security]

depends_on: []
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/api/src/lib/contexts/private-photos/"
  issues: []
  prs: []

validation:
  criteria:
    - "Photo endpoints return a photo only to its owner"
    - "Photos never appear in public view, feed or another user's screens"
  review_by: null
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-005
---
# DR-0005 · Private Progress Photos

## Legacy status

Accepted

## Context

Progress photos are personal. Should not be visible to family.

## Decision

Private Supabase Storage bucket. Owner-only via signed URLs. Never in public view.

## Rationale

- Privacy guaranteed at Storage level
- Supabase handles CDN and RLS

## Consequences

- Bucket `progress-photos` with `public: false`
- Limit 5 photos per workout

## Referenced by

- [private-photos](../docs/prd/features/private-photos.md)
- [public-view](../docs/prd/features/public-view.md)

## Log

- 2026-07-21 accepted as ADR-005 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/005-private-photos.md; status mapped to the code as of today: implemented. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet.
- 2026-11-04 note: Storage moved from a private Supabase bucket to Cloudflare R2 under DR-0027; the owner-only rule is unchanged.
