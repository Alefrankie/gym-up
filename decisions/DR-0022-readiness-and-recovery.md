---
id: DR-0022
title: "Readiness Check-In and Muscle Recovery Model"
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
    - "Readiness check-in takes 10 s or less and can be skipped or disabled"
    - "Readiness data is owner-only"
  review_by: null
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-022
---
# DR-0022 · Readiness Check-In and Muscle Recovery Model

## Legacy status

Accepted

## Context

Gravl adapts each session to how the user feels and shows a per-muscle recovery map ("which muscles are fresh"). Phase 1 has static safety rules: `MaxConsecutiveDays: 4`, `MinHoursBetweenSameMuscleGroup: 48`, `MaxSetsPerMusclePerWeek: 20`. We need a simple, explainable version of both.

## Decision

### 1. Readiness check-in (optional, ≤ 10 s)

Shown when the user taps *Empezar* (skippable; it can be disabled in Settings with `profiles.readiness_enabled`). Three 1–5 sliders:

| Question (es) | 1 | 5 |
|---|---|---|
| ¿Cómo dormiste? | Muy mal | Muy bien |
| ¿Energía hoy? | Agotado | A tope |
| ¿Agujetas / dolor? | Mucho dolor | Nada |

`score = round((sleep + energy + soreness) / 3, 1)`, stored in `readiness_checkins(id, user_id, workout_id, sleep, energy, soreness, score, created_at)` and copied to `workouts.readiness_score`.

| Score | Band | Adjustment applied on top of [ADR-021](./DR-0021-progression-engine.md) suggestions |
|---|---|---|
| ≥ 3.5 | `good` | None |
| 2.5 – 3.4 | `moderate` | −1 working set per exercise (min 1) |
| < 2.5 | `low` | −1 working set (min 1) **and** weight × 0.9; banner "Hoy sesión ligera" |

Adjustments change only suggestions and prefilled targets. The user can still log anything.

### 2. Muscle recovery (derived, no table)

Per muscle in `MuscleGroups` ([ADR-017](./DR-0017-exercise-catalog.md)), from completed workouts of the last 7 days:

- `hard_sets(m)`: completed working sets where `m` is the primary muscle (weight 1.0) or a secondary muscle (weight 0.5).
- `hours_since(m)`: hours since the last such set.
- Recovery window: `48 h` (`HealthRules.MinHoursBetweenSameMuscleGroup`) if hard_sets in that session ≤ 10, else `72 h`.
- `recovery% = min(100, hours_since / window × 100)`.

States: `fresh` (100 %), `recovering` (50–99 %), `fatigued` (< 50 %). The dashboard shows a body list or heat map with these states, and the routine picker marks routines whose primary muscles are `fatigued`.

### 3. Soft warnings (replacing Phase 1 hard rules, per [ADR-016 §5](./DR-0016-workout-data-model-v2.md))

| Warning | Trigger | Where |
|---|---|---|
| Días seguidos | 4th consecutive training day (`MaxConsecutiveDays`) | Dashboard banner |
| Volumen alto | > 20 hard sets for a muscle in the trailing 7 days | Weekly stats + dashboard |
| Músculo fatigado | Starting a routine whose primary muscle is `fatigued` | Readiness step |

Warnings never block.

## Rationale

- Three questions are the minimum signal Gravl-like apps use. It is fast enough to not annoy.
- Recovery is derived from data we already have, so there is nothing to keep in sync.

## Trade-offs

- **Pro:** Explainable, cheap, no wearables.
- **Con:** Subjective input. It is fine as a nudge, not as medicine.

## Consequences

- Table `readiness_checkins` is **owner-only** (health data, same class as [ADR-023](./DR-0023-body-metrics-privacy.md)). `workouts.readiness_score` is copied onto a read-all row, but siblings' UI never shows it.
- `profiles.readiness_enabled` (default true).

## Referenced by

- [progression PRD](../docs/prd/features/progression.md)
- [progression context](../docs/architecture/contexts/progression/readme.md)

## Log

- 2026-10-01 accepted as ADR-022 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/022-readiness-and-recovery.md; status mapped to the code as of today: accepted. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet.
- 2026-11-04 note: Not built on 2026-11-04 (no readiness_checkins table).
- 2026-11-04 note: Where it mentions Supabase/RLS/Astro, DR-0027 supersedes the implementation detail.
