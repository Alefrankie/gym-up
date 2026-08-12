---
id: ADR-014
title: AI Nutrition Analysis — Google Gemini Vision Provider
type: decision
status: accepted
date: 2026-08-12
---

# ADR-014: AI Nutrition Analysis — Google Gemini Vision Provider

## Status

Accepted

## Context

The nutrition context ([PRD: FR-NA-003](../../prd/features/nutrition.md)) accepts a photo of food and returns estimated calories and macronutrients. The PRD originally listed three candidate providers — Google Gemini Vision, OpenAI GPT-4 Vision, and Claude Vision — without picking one. The architecture context ([nutrition/readme.md](../contexts/nutrition/readme.md)) had already implicitly committed to Gemini by referencing a `GeminiVisionAdapter` and a `AIAnalysisRules.DefaultModel = 'gemini-2.5-flash'` constant, but no ADR documented the choice.

Story-5.1 surfaced this gap as a DISCREPANCY during gap analysis and the user resolved it: pick **Gemini Vision (`gemini-2.5-flash`)** for round 5.

## Decision

Round 5 of the nutrition context uses **Google Gemini Vision (`gemini-2.5-flash`)** as the AI provider for the photo analysis endpoint. The choice is pinned in three places:

1. **Domain constant** — `AIAnalysisRules.DefaultModel = 'gemini-2.5-flash'` in `src/lib/contexts/nutrition/domain/nutrition.constants.ts`.
2. **Adapter** — `GeminiVisionAdapter` at `src/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter.ts` implements the `AIAnalysisPort` interface (per [ADR-011](./011-implements-not-extends.md)).
3. **Composition root** — `src/lib/contexts/nutrition/nutrition.composition.ts` instantiates the adapter with `process.env.GEMINI_API_KEY`.

## Rationale

- **Already in the architecture context.** The architecture doc references Gemini by example. Reversing the implicit choice would orphan example code and constants.
- **Free tier is generous.** `gemini-2.5-flash` is on the free tier during development, which matches the round-1..5 no-credentials rule ([stories/phase-1/readme.md](../../stories/phase-1/readme.md)).
- **OpenAI GPT-4 Vision** requires a paid billing account from day one; out of scope for round 5.
- **Claude Vision** was not generally available at the time the architecture was written; not evaluated.

## API contract (round 5)

The adapter calls the Gemini REST API at:

```
POST https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={apiKey}
```

The request body is JSON with an `inline_data` part carrying the base64 image and its MIME type. The MIME type is derived from the validated `format` field (`jpg` → `image/jpeg`, `png` → `image/png`, `webp` → `image/webp`) — not hardcoded — to avoid the silent format-corruption bug class documented in [`.crew/crew-learnings.md`](../../../.crew/crew-learnings.md).

The response is parsed into a typed `AIAnalysisResult` by `parseGeminiResponse` (deterministic unit-tested helper). Empty `food_items[]` and unparseable responses are mapped to `AIUnrecognizedFoodError` (HTTP 502).

A 30-second `AbortController` timeout is enforced per `AIAnalysisRules.TimeoutMs` (per [FR-NA-004](../../prd/features/nutrition.md)).

## Trade-offs

- **Pro:** No billing account required during development; free tier covers round 5's manual testing.
- **Pro:** Architecture doc example code can be promoted almost verbatim into the adapter.
- **Pro:** Provider swap is a single-class change because the port abstracts it (`AIAnalysisPort`).
- **Con:** Gemini's free tier quotas may bite during load testing. Production traffic in round 6+ should re-evaluate.
- **Con:** Response shape is not standardized across providers — a swap to OpenAI / Claude later requires re-validating `parseGeminiResponse`'s twin (`parseOpenAIResponse`, `parseClaudeResponse`).

## Consequences

- `process.env.GEMINI_API_KEY` becomes a required env var when the nutrition context is wired in production. Missing key → `MissingApiKeyError` → HTTP 500.
- The `InMemoryAIAnalysisAdapter` (test-only) keeps unit tests deterministic and offline. `GeminiVisionAdapter` is exercised via a fake HTTP client in adapter-integration tests (no real network calls).
- Round 6 (Supabase) does **not** change this ADR. The port/adapter pattern isolates the provider; round 6 only swaps the storage and database.
- Future provider evaluations must add a new adapter and (if response shape differs) a new parser — they do **not** edit `GeminiVisionAdapter`.

## References

- [nutrition/readme.md](../contexts/nutrition/readme.md) — full domain spec
- [analyze-meal.flow.md](../contexts/nutrition/flows/analyze-meal.flow.md) — happy + failure paths
- [PRD FR-NA-003..005](../../prd/features/nutrition.md) — functional requirements
- [ADR-007](./007-repository-pattern.md) — abstract-class pattern (applied here to the AI port)
- [ADR-011](./011-implements-not-extends.md) — `implements`, not `extends`
- [ADR-010](./010-per-context-composition.md) — per-context composition root