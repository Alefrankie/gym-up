---
id: DR-0001
title: "Supabase Client-side SDK"
status: superseded
tier: 3
date: 2026-07-21
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: system
reversibility: costly
risk_flags: [security]

depends_on: []
supersedes: []
superseded_by: DR-0027
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
legacy_id: ADR-001
---
# DR-0001 · Supabase Client-side SDK

## Legacy status

Superseded by [ADR-027](./DR-0027-mobile-architecture-nestjs-sveltekit-tauri.md) (2026-10-29)

## Context

Need to decide how frontend communicates with Supabase: directly from browser or through server-side API routes.

## Decision

Use `@supabase/supabase-js` directly in the browser. Astro pages call Supabase via client-side JS in `<script>` tags or React islands.

## Rationale

- Simpler than server-side API routes for CRUD
- RLS handles auth at DB level
- No need for custom API layer

## Consequences

- Supabase URL and anon key are public (by design — RLS protects data)
- Security depends entirely on RLS policies

## Referenced by

- [system.md](../docs/architecture/system.md)
- [workout-tracking](../docs/prd/features/workout-tracking.md)

## Log

- 2026-07-21 superseded as ADR-001 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/001-supabase-client-side.md; status mapped to the code as of today: superseded. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria left empty: superseded before any criteria were recorded.
