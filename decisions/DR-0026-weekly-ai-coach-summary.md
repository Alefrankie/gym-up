---
id: DR-0026
title: "Weekly AI Coach Summary — Gemini Text, Facts Computed First, Cached per Week"
status: accepted
tier: 2
date: 2026-10-01
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: local
reversibility: easy
risk_flags: [privacy, cost]

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
    - "The LLM only phrases facts computed deterministically first"
    - "At most one generated summary per user per ISO week (cached)"
  review_by: null
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-026
---
# DR-0026 · Weekly AI Coach Summary — Gemini Text, Facts Computed First, Cached per Week

## Legacy status

Accepted. Reuses the provider choice of [ADR-014](./DR-0014-ai-nutrition-analysis.md).

## Context

Gravl gives a coach-like narrative of progress. We already integrate Gemini for nutrition. A weekly summary ("Subiste 5 kg en press banca, piernas estancadas, 3/4 entrenos") adds the "coach voice" without putting AI in the progression hot path ([ADR-021](./DR-0021-progression-engine.md)).

## Decision

1. **Facts first, prose second.** `BuildWeeklyFactsUseCase` (progress context) computes a deterministic JSON for the ISO week (Mon–Sun, user timezone):
   - workouts done vs planned (`days_per_week`);
   - total volume and sets vs the previous week;
   - PRs ([ADR-020](./DR-0020-personal-records.md));
   - plateaued exercises and the deload status ([ADR-021](./DR-0021-progression-engine.md));
   - muscle sets distribution;
   - average readiness;
   - body-weight delta (owner-only data, owner's own summary only).
2. **The LLM only phrases the facts.** `CoachSummaryPort.generate(facts, locale='es')` calls Gemini text generation using the same model constant as nutrition (`AIAnalysisRules.DefaultModel`, currently `gemini-3.5-flash` in code). The prompt forbids numbers that are not in the facts and forbids medical advice. Output: ≤ 120 words plus 1–3 bullet "next week" tips taken from the facts' recommendations.
3. **Cache:** `ai_weekly_summaries(user_id, week_start, facts_json, summary_text, model, created_at)`, PK `(user_id, week_start)`, **owner-only**. Generated lazily on the first visit to `/progress` after the week closes, or on demand with "Generar resumen" for the current week (max 3 regenerations per week).
4. **Fallback:** if `GEMINI_API_KEY` is missing or the call fails or times out (20 s), render a template-based summary from the same facts. The feature never errors visibly.

## Rationale

- Computing the facts deterministically prevents hallucinated numbers. The model only adds tone.
- Lazy per-week generation keeps usage within the free tier (≤ 1 call per user per week).

## Consequences

- Env: reuses `GEMINI_API_KEY`.
- Adapter: `GeminiCoachSummaryAdapter` plus `TemplateCoachSummaryAdapter` (fallback and tests, no mocks per [ADR-009](./DR-0009-object-mothers.md)).

## Referenced by

- [progress PRD](../docs/prd/features/progress.md)
- [progress context](../docs/architecture/contexts/progress/readme.md)

## Log

- 2026-10-01 accepted as ADR-026 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/026-weekly-ai-coach-summary.md; status mapped to the code as of today: accepted. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet.
- 2026-11-04 note: Not built on 2026-11-04 (no weekly summary code found).
