---
story_id: "11.4"
round: "round-11"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/progress/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progress", "progression", "body-metrics"]
  prd_requirements: ["FR-PR-019", "FR-PR-020"]
  architecture_decisions: ["ADR-026"]
  flows: ["weekly-coach-summary.flow.md"]
blocked_by: ["story-11.2", "story-10.3"]
blocks: ["story-12.5"]
---

# Story 11.4 — Weekly AI Coach Summary

Parent: [../readme.md](../readme.md)

## Summary

Adds Gravl's weekly coach voice. `BuildWeeklyFactsUseCase` computes a deterministic JSON for an ISO week (workouts, volume, PRs, plateaus, deload, muscle sets, readiness, the owner's own body-weight delta); Gemini only phrases it (≤ 120 words plus 1–3 tips) and a template adapter produces identical-looking text when the key is missing or the call fails. Summaries are cached per week in the new owner-only table `ai_weekly_summaries` (migration 009), generated lazily for the last closed week, and *Generar resumen* for the current week is limited to 3. Closes Gravl row **G8**.

Context: [progress readme → Phase 2](../../../architecture/contexts/progress/readme.md#phase-2) · Flow: [weekly-coach-summary.flow.md](../../../architecture/contexts/progress/flows/weekly-coach-summary.flow.md) · ADR: [ADR-026](../../../architecture/decisions/026-weekly-ai-coach-summary.md) · Schema: [009](../../../architecture/database-schema.md#009--ai-weekly-summaries-adr-026) · PRD: [FR-PR-019, FR-PR-020](../../../prd/features/progress.md#fr-pr-019).

## Files in scope

**Modify**

- `db/schema.ts` — add `aiWeeklySummaries` (PK `(userId, weekStart)`); export `AiWeeklySummary`, `NewAiWeeklySummary`.
- `db/migrations/` — `0009_ai_weekly_summaries.sql` plus `meta/` from `drizzle-kit generate`.
- `src/lib/contexts/progress/domain/progress.constants.ts` — add `CoachSummaryRules` (`Model: AIAnalysisRules.DefaultModel`, `TemplateModel: 'template'`, `TimeoutMs: 20_000`, `MaxWords: 120`, `MinTips: 1`, `MaxTips: 3`, `MaxRegenerationsPerWeek: 3`, `Temperature: 0.4`, `SystemPrompt`); the model value is imported from `src/lib/contexts/nutrition/domain/nutrition.constants.ts` (a pure constant, shared kernel).
- `src/lib/contexts/progress/progress.composition.ts` — import `progressionInsightsPort` (10.3) and the existing `bodyWeightPort` (11.1); export `buildWeeklyFactsUseCase`, `getWeeklyCoachSummaryUseCase`, `regenerateWeeklySummaryUseCase`; instantiate `GeminiCoachSummaryAdapter` only when `GEMINI_API_KEY` is set.
- `src/pages/progress.astro` — section 1 *Resumen semanal* (`CoachSummaryCard`, `client:visible`); the card fetches after mount so SSR never waits on the model.

**Create**

- `supabase/migrations/009_ai_weekly_summaries.sql` — table, RLS enabled, policy `ai_weekly_summaries_own` (`FOR ALL`, `auth.uid() = user_id`), `regenerations` CHECK 0..3 (idempotent).
- Domain (`src/lib/contexts/progress/domain/`): `weekly-facts.ts` (`buildWeeklyFacts`, `recommendationsFor`, `allowedNumbers`, `validateCoachOutput`, `renderTemplateSummary`), `ports/weekly-summary.repository.ts`, `ports/coach-summary.port.ts`, `errors.ts` (`WeeklySummaryLimitError`).
- Application (`.../application/`): `build-weekly-facts.use-case.ts`, `get-weekly-coach-summary.use-case.ts`, `regenerate-weekly-summary.use-case.ts`, `generate-with-fallback.ts` (shared, never throws).
- Infrastructure: `sqlite/sqlite-weekly-summary.repository.ts`, `supabase/supabase-weekly-summary.repository.ts`, `ai/gemini-coach-summary.adapter.ts` (`GeminiCoachSummaryAdapter`), `ai/template-coach-summary.adapter.ts` (`TemplateCoachSummaryAdapter`).
- UI: `src/components/progress/coach-summary-card.tsx`.
- API: `src/pages/api/progress/coach-summary/index.ts` (GET `?week=last|current`), `src/pages/api/progress/coach-summary/regenerate.ts` (POST).
- Tests and mothers: see [Test Plan](#test-plan).

**Not in scope (must not change):** `GeminiVisionAdapter` and nutrition code (only the model constant is read), the stats use cases of 11.2 (consumed, not edited), the feed, member cards and share image (summaries are never shown there).

## Happy Path

1. On Monday the user opens `/progress`; the page renders immediately and `CoachSummaryCard` calls `GET /api/progress/coach-summary?week=last` ([FR-PR-019](../../../prd/features/progress.md#fr-pr-019)).
2. `GetWeeklyCoachSummaryUseCase` computes `weekStart` (previous ISO Monday in `profiles.timezone`) and finds no row in `ai_weekly_summaries`.
3. `BuildWeeklyFactsUseCase` builds `WeeklyFacts`: workouts done vs `days_per_week`, volume and sets vs the previous week, duration, PRs (`GetWorkoutPrsUseCase`), plateaus / deload / readiness average (`ProgressionInsightsPort`: `listPlateaus`, `getDeloadStatus`, `getReadinessAverage`), top-6 muscle sets and high-volume muscles, the owner's own body-weight delta (`BodyWeightPort`), masses in 1 decimal of the display unit, and 1–3 deterministic `recommendations`.
4. `GeminiCoachSummaryAdapter.generate(facts, 'es')` sends `CoachSummaryRules.SystemPrompt` and the facts with a 20 s timeout and `responseMimeType: application/json`; `validateCoachOutput` checks the result.
5. The row is upserted (`facts_json`, `summary_text` = summary followed by `- tip` lines, `model`, `regenerations = 0`). The card shows "Resumen semanal" with the text and tips plus *Ver semana actual*.
6. Later visits hit the cache: no model call (≤ 1 call per user per week).
7. *Ver semana actual* → `?week=current`; with no row the card shows *Generar resumen* → `POST /api/progress/coach-summary/regenerate` → facts for the partial week → generate → upsert with `regenerations + 1`; the card shows "Te quedan {n} esta semana". At 3 the button disables with "Disponible el lunes" ([FR-PR-020](../../../prd/features/progress.md#fr-pr-020)).
8. Without `GEMINI_API_KEY`, on a timeout, an HTTP error or output that fails validation, the template text is stored with `model = 'template'` and shown like any summary: no error is visible.

## Decisions

- **Model constant.** ADR-026 names `gemini-2.5-flash`; code uses `AIAnalysisRules.DefaultModel` (`gemini-3.5-flash`). Code wins ([phase rule 2](../readme.md#2-code-is-the-source-of-truth-for-conventions)): `CoachSummaryRules.Model` reuses that constant and `ai_weekly_summaries.model` stores whatever was actually used.
- **Regeneration counting.** Every *Generar resumen* tap on the current week counts (the first creates the row with `regenerations = 1`); closed weeks are generated once, lazily, and are not regenerated. `remainingRegenerations = 3 − regenerations`, reported for the current week only.
- **Card is a React island** that calls the API after render, so a slow Gemini call (≤ 20 s) never blocks `/progress` SSR. Offline it shows "Sin conexión" and retries on the next visit.
- **HTTP shape.** Same REST call shape as `GeminiVisionAdapter` (`AIAnalysisRules.GeminiEndpoint` with the model, `?key=`), text-only, `AbortController` at 20 s cleared in `finally`, injectable `fetchFn` for tests (same HTTP-boundary seam as the nutrition adapter's test, no other mocks).
- **Output rules.** `{ "summary": string, "tips": string[] }`; Spanish, ≤ 120 words; 1–3 tips; every number token in the output must be in `allowedNumbers(facts)` (also with `,` decimals); medical, injury and nutrition advice is forbidden by the prompt (not machine-checked).
- **No-activity weeks** still build facts (`done: 0`); `hit_frequency` (or `keep_going` when no plan is set) drives the tips: the summary is encouraging, never an error.
- **Privacy.** Body weight and readiness appear only in the owner's own summary; the table is owner-only and summaries never reach the feed or member cards ([ADR-023](../../../architecture/decisions/023-body-metrics-privacy.md) class).
- **Local date helper** from 11.1 (`localDateKey`) for week bounds.

## Acceptance Criteria

- AC-11.4-01: Migration 009 exists for both backends (`db/migrations/0009_ai_weekly_summaries.sql`, `supabase/migrations/009_ai_weekly_summaries.sql`), is idempotent on Supabase, and creates `ai_weekly_summaries` with PK `(user_id, week_start)` and `regenerations` constrained to 0..3.
- AC-11.4-02: `buildWeeklyFacts` for a fixture week returns the documented `WeeklyFacts` (version 1, locale `es`, `weekStart` Monday and `weekEnd` Sunday in `profiles.timezone`, `deltaPct` an integer or `null` when the previous week is 0, masses with 1 decimal in the display unit, top-6 `muscleSets`, `highVolumeMuscles` above 20 sets); `bodyWeight` is the owner's `getBodyWeightOn(weekEnd) − getBodyWeightOn(weekStart − 1 d)` or `null`.
- AC-11.4-03: `recommendationsFor` returns the first 3 applicable in the order `hit_frequency`, `deload_recommended`, `plateau_options`, `high_volume`, `low_readiness`, falling back to `keep_going`; the example facts (3 of 4 workouts, 1 plateau) give `hit_frequency` then `plateau_options`.
- AC-11.4-04: `validateCoachOutput` rejects unparsable JSON, a summary of 121 words, 0 or 4 tips, and a number not in the facts (e.g. "95" when no fact is 95); it accepts numbers equal to a fact written with a comma decimal.
- AC-11.4-05: `renderTemplateSummary` is deterministic: for the example facts it contains "3 de 4 entrenamientos", the total volume with its unit and "8 %", the PR line, "Estancado: Squat (Barbell)", and the readiness line "Tu energía media fue 3.8/5."; tips = `recommendations[].text`.
- AC-11.4-06: The last closed week is generated lazily on first view and cached: the second call returns the same row with no generator call; the stored `summary_text` is the summary followed by `- tip` lines and `regenerations = 0` (round AC-R11-05).
- AC-11.4-07: Without `GEMINI_API_KEY` the template text appears with `model = 'template'` and no error; with a key, a timeout (20 s), HTTP error, invalid JSON or failed validation also falls back to the template; `generateWithFallback` never throws.
- AC-11.4-08: With a valid Gemini response the stored `model` equals the model actually used (`AIAnalysisRules.DefaultModel`); the prompt sent is `CoachSummaryRules.SystemPrompt` plus the facts JSON.
- AC-11.4-09: `week=current` without a row returns `null` (the card shows *Generar resumen*); `RegenerateWeeklySummaryUseCase` creates the row with `regenerations = 1` on the first tap and increments on each tap; at 3 it throws `WeeklySummaryLimitError` (429) and the button shows "Disponible el lunes"; the next Monday the counter is new because `week_start` changes.
- AC-11.4-10: `BuildWeeklyFactsUseCase` consumes `ProgressionInsightsPort` (`listPlateaus`, `getDeloadStatus`, `getReadinessAverage`): a plateaued exercise, an active or recommended deload and the average readiness of the week appear in the facts; a user without check-ins gets `readiness: { average: null, checkins: 0 }`.
- AC-11.4-11: `CoachSummaryCard` renders skeleton lines while loading, then ≤ 120 words and 1–3 tips, *Ver semana actual* and *Generar resumen*; template text looks identical to model text; offline shows "Sin conexión"; `/progress` SSR completes without waiting for the model.
- AC-11.4-12: RLS: as a non-owner, `select`, `insert` and `update` of another user's `ai_weekly_summaries` row fail or return nothing (`tests/supabase/rls-ai-weekly-summaries.integration.test.ts`); the SQLite repository guards every query with `where user_id = ?`; endpoints return 401 without a session and use only the session user.
- AC-11.4-13: Both backends (`STORAGE_BACKEND=sqlite|supabase`) cache and regenerate identically. Phase 1 regression: migration 009 on `tests/fixtures/phase-1.db` leaves history, `/progress` points and streak unchanged, and a user with only Phase 1 workouts gets a summary without error.

## Tasks

- [ ] `T11.4-01` - `db/schema.ts` `aiWeeklySummaries`, `drizzle-kit generate` (`0009_ai_weekly_summaries.sql`), `supabase/migrations/009_ai_weekly_summaries.sql` with RLS; migration test on the Phase 1 fixture.
- [ ] `T11.4-02` - `CoachSummaryRules` in `progress.constants.ts` (model from `AIAnalysisRules.DefaultModel`, `SystemPrompt`), `WeeklySummaryLimitError`.
- [ ] `T11.4-03` - `weekly-facts.ts` (`buildWeeklyFacts`, `recommendationsFor`, `allowedNumbers`, `validateCoachOutput`, `renderTemplateSummary`) with table-driven tests.
- [ ] `T11.4-04` - Ports `WeeklySummaryRepository`, `CoachSummaryPort`; `SqliteWeeklySummaryRepository` (owner guard) with repo tests.
- [ ] `T11.4-05` - `SupabaseWeeklySummaryRepository` and `rls-ai-weekly-summaries.integration.test.ts` as a non-owner.
- [ ] `T11.4-06` - `TemplateCoachSummaryAdapter` and `GeminiCoachSummaryAdapter` (20 s `AbortController`, JSON response mime type, `validateCoachOutput` before returning, `fetchFn` seam) with adapter tests.
- [ ] `T11.4-07` - `BuildWeeklyFactsUseCase` (reuses 11.2 stats helpers, `GetWorkoutPrsUseCase`, `ProgressionInsightsPort`, `BodyWeightPort`, `ExerciseCatalogPort`) with use-case tests on real SQLite.
- [ ] `T11.4-08` - `generateWithFallback`, `GetWeeklyCoachSummaryUseCase`, `RegenerateWeeklySummaryUseCase`; tests for lazy generation, cache hit, no key, limit.
- [ ] `T11.4-09` - Composition exports and API `GET /api/progress/coach-summary`, `POST /api/progress/coach-summary/regenerate` (200 / 429 / 401).
- [ ] `T11.4-10` - `CoachSummaryCard` island and the *Resumen semanal* section on `/progress`.
- [ ] `T11.4-11` - Cross-backend and Phase 1 regression checks.
- [ ] `T11.4-12` - Update docs: mark context Use Cases rows (`BuildWeeklyFactsUseCase`, `GetWeeklyCoachSummaryUseCase`, `RegenerateWeeklySummaryUseCase`) `implemented`, fix any doc/code drift found (model name in ADR-026 note), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/progress/weekly-facts.test.ts` | unit (pure, table-driven) | facts from a fixture week, recommendation order and cap, `validateCoachOutput` (121 words, 4 tips, foreign number "95", comma decimals), template text (02–05) |
| `tests/progress/build-weekly-facts.use-case.test.ts` | use-case (real SQLite + real providers' adapters) | plateaus, deload, readiness average, body-weight delta, week bounds across a timezone, no-activity week (02, 10) |
| `tests/progress/coach-summary-adapters.test.ts` | adapter | Gemini request shape, 20 s abort, invalid output → throws, `model` stored; template adapter output (07, 08) |
| `tests/progress/get-weekly-coach-summary.use-case.test.ts` | use-case | lazy generation and cache hit, no key → template, error → template, regeneration limit (3 → `WeeklySummaryLimitError`), `current` without row → `null` (06, 07, 09) |
| `tests/progress/sqlite-weekly-summary.repository.test.ts` | repo | owner guard, upsert on PK (12, 13) |
| `tests/progress/coach-summary-card.test.tsx` | component | skeleton, tips, *Generar resumen* states, offline (11) |
| `tests/progress/weekly-summary-migration.test.ts` | integration | table exists; Phase 1 fixture unchanged (01, 13) |
| `tests/supabase/rls-ai-weekly-summaries.integration.test.ts` | integration-RLS (gated) | non-owner cannot select, insert or update (12) |

Mothers: `WeeklyFactsMother.typicalWeek()` in `tests/progress/mothers/`; `GeminiResponseMother.ok(summary, tips)` for the `fetchFn` seam.

## Out of Scope

- Stats aggregates and the rest of `/progress` → story 11.2 (consumed here).
- Plateau / deload / readiness logic → stories 10.3 and 10.4 (read through `ProgressionInsightsPort`).
- Offline support for the summary (it needs the network) → noted in [ADR-025](../../../architecture/decisions/025-offline-live-workout.md), no work here.
- Regenerating closed weeks, chat-style coaching, or putting AI into the progression engine → not planned (ADR-021 keeps the engine deterministic).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
