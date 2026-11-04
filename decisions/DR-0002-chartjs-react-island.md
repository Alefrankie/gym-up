---
id: DR-0002
title: "Chart.js via React Island"
status: superseded
tier: 1
date: 2026-07-21
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: local
reversibility: easy
risk_flags: []

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
legacy_id: ADR-002
---
# DR-0002 · Chart.js via React Island

## Legacy status

Superseded by [ADR-027](./DR-0027-mobile-architecture-nestjs-sveltekit-tauri.md) (2026-10-29)

## Context

Need to render progress charts. Astro supports islands from React.

## Decision

Use Chart.js with React via `react-chartjs-2`, rendered as React island.

## Rationale

- React only loads for charts, not entire app
- Chart.js lightweight (~60KB gzipped)
- Responsive out of box

## Consequences

- Install `react`, `react-dom`, `chart.js`, `react-chartjs-2`
- Chart components are `.tsx` not `.astro`

## Referenced by

- [progress](../docs/prd/features/progress.md)

## Log

- 2026-07-21 superseded as ADR-002 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/002-chartjs-react-island.md; status mapped to the code as of today: superseded. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria left empty: superseded before any criteria were recorded.
- 2026-11-04 T1: no validation.criteria required.
- 2026-11-04 note: rules give T0 (easy x local); kept as T1 so the history stays in decisions/.
