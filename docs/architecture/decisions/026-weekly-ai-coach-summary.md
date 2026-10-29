---
id: ADR-026
title: Weekly AI Coach Summary — Gemini Text, Facts Computed First, Cached per Week
type: decision
status: accepted
date: 2026-10-01
---

# ADR-026: Weekly AI Coach Summary — Gemini Text, Facts Computed First, Cached per Week

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted. Reuses the provider choice of [ADR-014](./014-ai-nutrition-analysis.md).

## Context

Gravl gives a coach-like narrative of progress. We already integrate Gemini for nutrition. A weekly summary ("Subiste 5 kg en press banca, piernas estancadas, 3/4 entrenos") adds the "coach voice" without putting AI in the progression hot path ([ADR-021](./021-progression-engine.md)).

## Decision

1. **Facts first, prose second.** `BuildWeeklyFactsUseCase` (progress context) computes a deterministic JSON for the ISO week (Mon–Sun, user timezone):
   - workouts done vs planned (`days_per_week`);
   - total volume and sets vs the previous week;
   - PRs ([ADR-020](./020-personal-records.md));
   - plateaued exercises and the deload status ([ADR-021](./021-progression-engine.md));
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
- Adapter: `GeminiCoachSummaryAdapter` plus `TemplateCoachSummaryAdapter` (fallback and tests, no mocks per [ADR-009](./009-object-mothers.md)).

## Referenced by

- [progress PRD](../../prd/features/progress.md)
- [progress context](../contexts/progress/readme.md)
