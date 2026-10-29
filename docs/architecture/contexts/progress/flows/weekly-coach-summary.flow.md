# Weekly Coach Summary Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-PR-019, FR-PR-020](../../../../prd/features/progress.md#ai-coach)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [11.4](../../../../stories/phase-2/round-11/story-11.4.md) |
| Decisions | [ADR-026](../../../decisions/026-weekly-ai-coach-summary.md), [ADR-014](../../../decisions/014-ai-nutrition-analysis.md) |

## Happy Path

### Step 1 - Open /progress After the Week Closes

On Monday the user opens `/progress`. The page renders immediately; `CoachSummaryCard` (React island) calls `GET /api/progress/coach-summary?week=last`.

### Step 2 - Cache Miss

`GetWeeklyCoachSummaryUseCase` computes `weekStart` = previous ISO Monday in `profiles.timezone` and finds no row in `ai_weekly_summaries`.

### Step 3 - Build the Facts

`BuildWeeklyFactsUseCase` produces the deterministic `WeeklyFacts` JSON: workouts done vs `days_per_week`, volume and sets vs the previous week, duration, PRs (`GetWorkoutPrsUseCase`), plateaus and deload status (`progressionInsightsPort`), muscle sets, average readiness, and the owner's own body-weight delta (`bodyWeightPort`). Masses are in the user's unit, rounded to 1 decimal. `recommendationsFor` adds 1–3 recommendations.

### Step 4 - Phrase With Gemini

`GeminiCoachSummaryAdapter.generate(facts, 'es')` sends the system prompt (`CoachSummaryRules.SystemPrompt`) and the facts, with a 20 s timeout, and expects `{ "summary", "tips" }` JSON. `validateCoachOutput` checks ≤ 120 words, 1–3 tips and that every number appears in the facts.

### Step 5 - Store and Show

The row is upserted (`facts_json`, `summary_text` = summary + "- tip" lines, `model`, `regenerations = 0`). The card shows "Resumen semanal" with the text and the tips, plus *Ver semana actual*.

### Step 6 - Next Visits

Later visits hit the cache: no Gemini call (≤ 1 call per user per week).

---

## Edge Case: Current Week

*Ver semana actual* → `GET /api/progress/coach-summary?week=current`. Without a row the card shows *Generar resumen*. Tapping it → `POST /api/progress/coach-summary/regenerate` → facts for the partial week → generate → upsert with `regenerations + 1`. The card shows "Te quedan {n} esta semana".

## Edge Case: Regeneration Limit

At `regenerations = 3`, `RegenerateWeeklySummaryUseCase` throws `WeeklySummaryLimitError` (429). The button disables with "Disponible el lunes" (FR-PR-020).

## Edge Case: No Workouts Last Week

Facts still build (`done: 0`); the recommendation `hit_frequency` (or `keep_going` when no plan is set) drives the tips. The summary is encouraging, never an error.

## Edge Case: Private Data

Body weight and readiness appear only in the owner's own summary. Summaries are owner-only (RLS `ai_weekly_summaries_own`) and are never shown in the feed or on member cards.

## Failure: No API Key

`GEMINI_API_KEY` missing → `TemplateCoachSummaryAdapter` renders the summary from the same facts; `model = 'template'`. No error shown (ADR-026 §4).

## Failure: Gemini Error, Timeout or Invalid Output

HTTP error, 20 s timeout, unparsable JSON, > 120 words, wrong tip count or a number not in the facts → template fallback, stored with `model = 'template'`. The user sees normal text.

## Failure: Offline

The card shows "Sin conexión" (ADR-025 §1: the AI summary needs the network) and retries on the next visit.
