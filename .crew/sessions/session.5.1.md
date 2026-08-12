# Session: 5.1

Story: AI Nutrition Analysis Endpoint (`docs/stories/phase-1/round-5/story-5.1.md`)

Re-entry: no prior session log found for `session.5.1.md` — fresh start.

---

## Phase 0 — Rules Discovery

### Rules loaded

1. `golden-rules.md` (skill) — base implementation rules.
2. `qa-anti-patterns.md` (skill) — 9 categories. Flagged for this story:
   - **Category 6 (Error Path Completeness)** — AI timeout / unrecognized food must map to a clean typed error the endpoint surfaces (FR-NA-004, FR-NA-005). Catch+`status:'error'` pattern is mandatory.
   - **Category 9 (Type-Safety Blind Spots)** — Parsing the AI provider's JSON into typed DTOs is the highest-risk seam. Must run `tsc --noEmit` after the parser is added, not rely on Vitest alone.
   - **Category 2 (Calculation)** — partial relevance: AI returns `food_items[]` with per-item calories that must sum into `total_calories` (invariant). Need an explicit sum-equals check or accept the AI's totals (decision: spec says parse what AI returns — `total_calories` is what we display; not a calculation bug surface).
3. No `AGENTS.md` / `CLAUDE.md` / `.implement-rules.md` in project root — skipped.
4. Project `crew-learnings.md` (quarantine, project) — 2 rules:
   - `before assuming a schema migration is missing for a table` — **loaded**: grepped `db/migrations/*.sql` and `_journal.json` for `nutrition`/`nutrition_entries`. Neither appears. Confirmed missing — the table is deferred to story-5.3 per the architecture context, so out of scope here.
   - `when a repository method reconstructs a derived value from input fields` — **loaded as context**; relevant if `AnalyzeMealUseCase` reconstructs any derived input (it does not — story-5.1 receives raw bytes and forwards to the AI port).
5. Skill `crew-learnings.md` (quarantine, skill) — selectively loaded by trigger:
   - `before writing import statements in Astro/Vite projects` — **loaded**: project uses `@/` and `@db/` aliases (verified in `astro.config.mjs` + `tsconfig.json` + `vitest.config.ts`). All imports MUST use `@/lib/contexts/nutrition/...` and `@db/schema`.
   - `declaring implementation done after changing a function/method signature` — **loaded**: Julian's AI response parser is a shared function; if its signature changes during the session, plan includes a `tsc --noEmit` step.
   - `scoping the blast radius of a backend contract change` — **loaded**: new endpoint `POST /api/nutrition/analyze` is a new route, not a contract change — no existing callers to scan. Plan still notes that story-5.2 will introduce the first caller (the photo-capture island).
   - `mocking node:fs in Vitest ESM test` — **not loaded**: this story does not touch filesystem writes (deferred to story-5.3).
   - `running typecheck for UI stories` — **not loaded**: this story has no UI surface (story-5.2 does).
   - `story's tasks reference an existing service with no explicit new behavior described` — **loaded as caution**: story-5.1's T5.1-02 says "Integrate AI provider (Gemini or OpenAI)" without picking one — flagged for Angel's questions.

### Patterns

- **No `.pattern.md` / `.flow.md`** exists for nutrition.
- **Infer pattern from closest analogue**: `src/lib/contexts/private-photos/` (story-4.2) — same shape (multipart validation, server endpoint at `src/pages/api/photos.ts`, abstract repo, sqlite impl, composition root).
- **Relevant flow**: `docs/architecture/contexts/nutrition/flows/analyze-meal.flow.md` — 8-step happy path with 4 named failure modes.

### Architecture context read

- `docs/architecture/contexts/nutrition/readme.md` — full spec (domain types, ports, AI adapter shape, composition root).
- `docs/prd/features/nutrition.md` — FR-NA-001..011 (story-5.1 implements FR-NA-003, FR-NA-004, FR-NA-005).
- `docs/architecture/decisions/007-repository-pattern.md` — repository pattern (referenced indirectly; the story frontmatter `architecture_decisions: ["ADR-007"]` is ambiguous — see Phase 1 DISCREPANCY).
- `docs/architecture/decisions/011-implements-not-extends.md` — `implements`, not `extends`.

### Pre-flight items flagged for downstream phases

- [ ] No `AGENTS.md` / `CLAUDE.md` in project — Phase 0 picks up `golden-rules.md` as the only stable rule source.
- [ ] Path aliases verified: `@/*` -> `src/*`, `@db/*` -> `db/*`.
- [ ] Story-5.1 blocks story-5.2 (confirmed in `story-5.2.md`).
- [ ] Story-5.1 has no DB schema dependency in its scope (DB rows are story-5.3's).
- [ ] Self-QA categories selected for Phase 3: **6 (Error Paths)**, **9 (Type-Safety)**.

---

## Phase 1 — Angel Gap Analysis & Scope

### Angel — Problem Briefing

**What's happening:** Round 5 introduces the nutrition context from scratch — the first story is a server-side endpoint that takes a base64 food photo and returns calorie/macro estimates from an AI vision provider. No nutrition code exists yet; this scaffolds the bounded context.

**Why it happens:** The PRD (`docs/prd/features/nutrition.md`) defines nutrition as a feature area with FR-NA-001..011. Story-5.1 implements the AI piece (FR-NA-003..005). The photo capture UI (story-5.2) and history/save (story-5.3) depend on this endpoint existing.

**Where it lives:** New files only — no existing code touched.
- `src/lib/contexts/nutrition/` (bounded context: domain, application, infrastructure)
- `src/pages/api/nutrition/analyze.ts` (server route)

**What done looks like:** A logged-in user POSTs a base64 photo (validated jpg/png/webp, ≤ 5MB) to `/api/nutrition/analyze`; the server calls an AI provider with a 30s timeout; the response is a typed `AIAnalysisResult` with totals + per-food items. Errors for bad input (400), unrecognized food (502 + clear message), and timeouts (504) all surface cleanly.

### Specs Read

- [story-5.1.md](../../stories/phase-1/round-5/story-5.1.md) (full)
- [docs/prd/features/nutrition.md](../../prd/features/nutrition.md) (full)
- [docs/architecture/contexts/nutrition/readme.md](../../architecture/contexts/nutrition/readme.md) (full)
- [docs/architecture/contexts/nutrition/flows/analyze-meal.flow.md](../../architecture/contexts/nutrition/flows/analyze-meal.flow.md) (full)
- [docs/architecture/decisions/007-repository-pattern.md](../../architecture/decisions/007-repository-pattern.md) (full)
- [docs/architecture/decisions/011-implements-not-extends.md](../../architecture/decisions/011-implements-not-extends.md)
- [docs/architecture/decisions/readme.md](../../architecture/decisions/readme.md) (confirmed ADR-007 = repository pattern)
- [docs/stories/phase-1/readme.md](../../stories/phase-1/readme.md) (Phase rule: no Supabase in rounds 1-5)
- [docs/stories/phase-1/round-5/story-5.2.md](../../stories/phase-1/round-5/story-5.2.md), [story-5.3.md](../../stories/phase-1/round-5/story-5.3.md) (downstream stories)
- Closest existing pattern: [src/pages/api/photos.ts](../../src/pages/api/photos.ts), [src/lib/contexts/private-photos/](../../src/lib/contexts/private-photos/)

### Patterns Found

**None — no `.pattern.md` / `.flow.md` exists for nutrition.**

Will infer pattern from `private-photos` (story-4.2):
- Server endpoint at `src/pages/api/<resource>.ts`, auth-gated, status-coded errors.
- Abstract repository class in `domain/ports/`, sqlite impl in `infrastructure/sqlite/`, composition root at `src/lib/contexts/<ctx>/<ctx>.composition.ts`.
- Use cases in `application/` exporting typed domain errors (`PhotoSizeExceededError`, etc.).

The existing `/api/photos.ts` uses multipart; the new endpoint uses JSON with inline base64 (intentional — AI vision APIs accept base64 JSON).

### Gap Analysis

| Task / AC | Status | Evidence | Notes |
|---|---|---|---|
| T5.1-01 — Create server route structure | MISSING | no file at `src/pages/api/nutrition/analyze.ts` | new |
| T5.1-02 — Integrate AI provider (Gemini or OpenAI) | MISSING | no `src/lib/contexts/nutrition/` exists | new |
| T5.1-03 — Parse AI response into structured DTOs | MISSING | — | new |
| T5.1-04 — Handle timeout and error cases | MISSING | — | new |
| T5.1-05 — Add validation (format, size) | MISSING | — | new |
| AC-5.1-01 — Endpoint accepts photo + returns estimates (FR-NA-003) | MISSING | — | covers T5.1-01..03 |
| AC-5.1-02 — Async processing, 30s timeout (FR-NA-004) | MISSING | — | covers T5.1-04 |
| AC-5.1-03 — Error on unrecognized food (FR-NA-005) | MISSING | — | covers T5.1-04 |

### Edge Cases Identified

- **AI returns empty `food_items[]`** — must map to "Food not recognized" error (FR-NA-005). Anti-pattern 6 trigger.
- **AI times out (>30s)** — must map to clear user-facing message. Anti-pattern 6 trigger.
- **AI returns malformed JSON** — must not crash; must surface a typed error. Anti-pattern 6 + 9 trigger.
- **Image bytes are wrong format** (e.g. PDF labeled jpg) — AI provider rejects; surface that error rather than throwing 500.
- **No auth / invalid session** — 401 (mirrors `/api/photos.ts`).
- **Body too large** — server should enforce ≤ 5MB even though client compresses (defense in depth).
- **Concurrent requests from same user** — no special handling needed; AI provider handles.
- **Base64 with `data:image/...;base64,` prefix** — common from `<canvas>.toDataURL()`; parser must strip it before calling AI adapter.

### Integration Points

- `getAuthService()` from `src/lib/contexts/auth/auth.composition.ts` — session check.
- `getSessionIdFromRequest()` from `src/lib/auth/cookie-helpers.ts` — cookie parse.
- New `src/lib/contexts/nutrition/nutrition.composition.ts` — wires the AI port + use case.
- New `src/pages/api/nutrition/analyze.ts` — the route.
- `AIAnalysisRules` and `PhotoRules` constants from the architecture context will live in `src/lib/contexts/nutrition/domain/nutrition.constants.ts`.
- Story-5.2 (photo capture UI) will be the first caller; story-5.3 (history/save) does NOT depend on this endpoint's response shape for its save flow (it saves after user edits).

### Legacy Behavior Concerns

None — brand new context. No existing behavior to preserve.

### Questions for User

> Have a proposal, or want my recommendation?

**Question 1 — AI provider choice (DISCREPANCY D2)**

The PRD says "TBD" and T5.1-02 says "Gemini or OpenAI." The architecture context already shows a `GeminiVisionAdapter` using `gemini-2.5-flash`. Pick one before I scope the adapter.

> **My recommendation:** **Gemini Vision (`gemini-2.5-flash`).** Reasons: (a) the architecture context already commits to it via `AIAnalysisRules.DefaultModel`; (b) Gemini's free tier is generous for development; (c) OpenAI requires separate API key + billing setup; (d) consistent with `nutrition/readme.md` example.
>
> **Alternatives considered:** OpenAI GPT-4 Vision (more expensive, requires billing); Claude Vision (no official vision API at the time of architecture writing). Both would replace the adapter class only — domain/port/use case stay identical.
>
> **Tradeoff if alternative:** swap the adapter class + env var name; no other code change needed thanks to the port abstraction.

**Question 2 — Disambiguate ADR-007 (DISCREPANCY D1 / D3)**

Story-5.1's frontmatter `architecture_decisions: ["ADR-007"]` and the PRD link to `007-ai-nutrition-analysis.md`. Neither matches the on-disk ADR-007 (Repository Pattern). There is no AI-nutrition ADR on disk.

> **My recommendation:** Two-part fix.
> 1. For this story's scope, **drop `architecture_decisions: ["ADR-007"]`** from `story-5.1.md` frontmatter — story-5.1 doesn't actually touch repositories (those are story-5.3). Add `ADR-010` (per-context composition) and `ADR-011` (implements-not-extends) since the new context will use them.
> 2. **Open a follow-up** (either part of this story or a separate documentation ticket) to either (a) write a new `ADR-014-ai-nutrition-analysis.md` documenting the provider choice from Q1, or (b) accept that the architecture context (`nutrition/readme.md`) is sufficient and delete the stale PRD link.
>
> **Alternatives considered:** Leave the link broken and ship (rejected — propagates spec drift into future rounds).
>
> **Tradeoff if alternative:** leave it; future rounds will hit the same broken link.

**Question 3 — Format-aware MIME mapping in the AI adapter (DISCREPANCY D4)**

The architecture context's `GeminiVisionAdapter` example hardcodes `mime_type: 'image/jpeg'`. The endpoint accepts jpg/png/webp.

> **My recommendation:** Map format → MIME in the adapter: jpg → `image/jpeg`, png → `image/png`, webp → `image/webp`. The endpoint already knows the format (validator requires it), so it can pass `format` into the adapter along with the bytes.
>
> **Alternatives considered:** Let the AI provider auto-detect (works for most cases but is brittle for webp and SVG-disguised-as-jpg).

**Question 4 — Body encoding: JSON base64 vs multipart file**

Story says "base64 image in request body." The closest existing endpoint (`/api/photos.ts`) uses multipart. AI vision APIs accept both shapes.

> **My recommendation:** **JSON body** with `{ format, imageBase64 }` — matches the story literally and matches what `MealPhotoCapture` (story-5.2) will produce via `<canvas>.toDataURL()`. Strip the `data:image/...;base64,` prefix if present. Validate size in bytes after decode.
>
> **Alternatives considered:** Multipart (consistent with `/api/photos.ts` but adds an extra conversion step client-side; the AI provider doesn't gain anything from it).

**Question 5 — `nutrition_entries` DB table in scope?**

The architecture context's `SaveNutritionEntryUseCase` writes to `nutrition_entries`. That table doesn't exist (confirmed: no `nutrition` matches in `db/migrations/*.sql`, journal only has 2 entries).

> **My recommendation:** **Out of scope for story-5.1.** This story only returns the AI analysis — no save. Add the migration as part of story-5.3 (which actually persists entries). The architecture context's schema snippet is forward-looking reference, not a story-5.1 commitment.
>
> **Alternatives considered:** Add the migration now in story-5.1 (rejected — schema change with no caller violates golden-rules "Aggregates mutate only through own methods" and inflates the diff).

**Question 6 — HTTP status codes for AI errors**

Story doesn't pin status codes. `/api/photos.ts` uses 400/401/403/404/303. For an AI endpoint the mapping isn't obvious.

> **My recommendation:**
> - `400` — bad request: missing field, malformed base64, unsupported format, size > 5MB
> - `401` — no/invalid session
> - `502` — AI provider returned unparseable / empty result / unrecognized food ("Food not recognized. Try a clearer photo.")
> - `504` — AI provider timed out (>30s)
> - `500` — anything else (logged with full stack)
>
> **Alternatives considered:** 422 for AI errors (more semantically correct for "well-formed but unprocessable"). Acceptable but Vercel/standard tooling patterns lean toward 502/504 for upstream failures.

### Gap Summary

- DONE: 0 | PARTIAL: 0 | DISCREPANCY: 4 (D1 ADR ref + D2 provider + D3 missing ADR + D4 hardcoded MIME) | MISSING: 5 (T5.1-01..05) | NOT-STARTED: 0
- AC coverage: AC-5.1-01..03 all MISSING (no endpoint exists yet).

---

**Handing off to user — Angel stops here. Awaiting answers on Q1-Q6 before Alefrank alignment.**

---

## User Decision

| # | Question | User answer |
|---|---|---|
| Q1 | AI provider | **Gemini Vision (gemini-2.5-flash)** |
| Q2 | ADR-007 fix | **Limpiar frontmatter + crear ADR-014** (`014-ai-nutrition-analysis.md`) |
| Q3 | MIME mapping | **Sí, mapeo format-aware** (jpg→image/jpeg, png→image/png, webp→image/webp) |
| Q4 | Body encoding | **JSON body con base64** (strip `data:image/...;base64,` prefix if present) |
| Q5 | `nutrition_entries` schema | **Fuera de scope, deferir a story-5.3** |
| Q6 | Status codes | **400/401/502/504/500** (400=validation, 401=auth, 502=AI unparseable/no reconocido, 504=AI timeout, 500=resto) |

All discrepancies resolved cleanly — zero escalation to user needed beyond the original Q pass.

---

## Phase 1.5 — Alefrank Alignment Check (Round 1)

### Discrepancies Found

| # | Type | Description | Spec / Pattern Reference | Severity |
|---|------|-------------|--------------------------|----------|
| A1 | missing | Test file location not pinned. Project convention is `tests/<context>/<file>.test.ts` (per `vitest.config.ts` `include: ['tests/**/*.test.ts']` + existing `tests/private-photos/`, `tests/progress/`, etc.). | `vitest.config.ts:8`, `tests/private-photos/*.test.ts` | Minor |
| A2 | missing | Size check must run on **decoded bytes**, not base64 string length (base64 inflates by 4/3). Angel's "validate size in bytes after decode" was implicit, not explicit. | `nutrition/readme.md:55` `PhotoRules.MaxSizeBytes: 5 * 1024 * 1024` | Minor |
| A3 | missing | Error response shape should be a stable `{ error: string, code: string }` JSON (not free-form text like `/api/photos.ts` does — those are HTML strings). For an AI endpoint with a frontend client (story-5.2), structured errors matter. | `/api/photos.ts` precedent (raw text) vs. JSON client requirement from story-5.2 | Minor |
| A4 | missing | Fetch timeout mechanism not specified — must use `AbortController` + `setTimeout(..., 30_000)` rather than just `fetch()` with no timeout (default Node fetch has no timeout). | `AIAnalysisRules.TimeoutMs: 30_000` (`nutrition/readme.md:65`) | Minor |
| A5 | missing | Env var wiring — `GEMINI_API_KEY` needs to be read in `nutrition.composition.ts` (the adapter is constructed there). Should also gracefully fail when missing in tests (e.g., `process.env.GEMINI_API_KEY ?? 'test-key'` is fine since tests will inject a fake adapter). | `nutrition/readme.md:464` example shows `process.env.GEMINI_API_KEY!` (the `!` non-null assertion will throw at boot if env is missing — that's actually correct production behavior, just needs a typed default for tests) | Minor |
| A6 | missing | No consideration of base64 prefix stripping — when `<canvas>.toDataURL()` produces `data:image/png;base64,iVBOR...`, the prefix must be stripped before validation/decoding. Angel mentioned this in Edge Cases but it should be in the explicit pipeline. | Edge Cases list, line ~218 in this log | Minor |
| A7 | scope | Story AC doesn't pin error message wording. Flow file (`analyze-meal.flow.md:53`) says `"Food not recognized. Try a clearer photo or better lighting."` — that's the canonical user-facing string. Pin it now to prevent drift between 5.1 and 5.2. | `analyze-meal.flow.md:53` | Minor |
| A8 | missing | **In-memory AI adapter** for tests — golden-rules says "Before implementing production repository adapters, create an in-memory implementation first." Same principle applies to the AI port: we need `InMemoryAIAnalysisAdapter` for fast deterministic tests instead of mocking `fetch`. | `golden-rules.md` "Best Practices" | Minor |

No major discrepancies. Angel's briefing and gap analysis correctly captured scope; these are all refinements that can be resolved in a single rectification pass.

### Resolution

All 8 minor items sent to Angel for rectification in Round 2.

---

## Phase 1.5 — Angel Rectification (Round 2)

### Corrections applied

- **A1** — Tests pinned to `tests/nutrition/<name>.test.ts` (mirrors `tests/private-photos/`).
- **A2** — Size check is **post-decode**: decode base64 → measure `Uint8Array.byteLength` → compare against `PhotoRules.MaxSizeBytes`.
- **A3** — Endpoint returns JSON `{ error: string, code: 'INVALID_INPUT' | 'UNAUTHORIZED' | 'AI_UNRECOGNIZED' | 'AI_TIMEOUT' | 'INTERNAL' }` with corresponding HTTP status. `Content-Type: application/json`.
- **A4** — AI adapter uses `AbortController` with `setTimeout(abort, AIAnalysisRules.TimeoutMs)`; cleanup `clearTimeout` in finally.
- **A5** — `nutrition.composition.ts` reads `process.env.GEMINI_API_KEY ?? ''`; adapter constructor validates non-empty and throws a typed `MissingApiKeyError` (caller → 500). Tests inject `InMemoryAIAnalysisAdapter`, never the real Gemini adapter.
- **A6** — Endpoint accepts base64 with optional `data:image/<fmt>;base64,` prefix; uses regex strip before validation. Format field is canonical (re-derived from prefix if present, else trusted from body).
- **A7** — User-facing error strings pinned:
  - unrecognized food: `"Food not recognized. Try a clearer photo or better lighting."`
  - timeout: `"Analysis took too long. Try again."`
  - file too large: `"Photo too large. Max 5MB."`
  - invalid format: `"Unsupported format. Use jpg, png, or webp."`
- **A8** — `InMemoryAIAnalysisAdapter` lives at `src/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter.ts`. Real adapter is `GeminiVisionAdapter` at `src/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter.ts`. `FakeGeminiHttpClient` (test util) wraps `fetch` for adapter-integration tests without hitting the network.

### Updated scope (delta vs. Round 1)

- Added: typed error classes (`MissingApiKeyError`, `AIUnrecognizedFoodError`, `AITimeoutError`, `InvalidPhotoError`).
- Added: `parseGeminiResponse` helper + unit tests (deterministic JSON → DTO mapping).
- Added: response DTO type `AnalyzeResponse` exported alongside the use case.
- Adjusted: validation order — decode → size → format (since decoded MIME sniff is more reliable than trusting the body's `format` field alone).

### Verdict

ALIGNED. No further discrepancies. Alefrank approves Julian to start.

> "Angel and I are aligned. Spec coverage is complete (AC-5.1-01..03 mapped to concrete tasks). No legacy behavior at risk (greenfield context). All pattern contracts match the inferred private-photos shape. The 8 minor refinements above are captured in the implementation plan. I approve Julian to start implementation."

---

## Phase 2 — Alefrank Implementation Plan

### Gap Summary (from Angel)

- DONE: 0 | PARTIAL: 0 | DISCREPANCY: 4 (resolved via user Q1/Q2/Q3/Q4) | MISSING: 5 (T5.1-01..05) | NOT-STARTED: 0
- AC-5.1-01..03 all MISSING (no endpoint exists).

### Plan Summary

Build a new server-side endpoint `POST /api/nutrition/analyze` plus the surrounding `nutrition` bounded context. The endpoint accepts JSON with `{ format, imageBase64 }`, decodes + validates the image (jpg/png/webp, ≤ 5MB decoded), calls Google's Gemini 2.5 Flash vision API with a 30-second `AbortController` timeout, parses the AI's JSON response into a typed `AIAnalysisResult`, and returns it to the client. All failures (bad input, no auth, AI unrecognized food, AI timeout, internal) map to clean JSON error responses with status codes 400/401/502/504/500. No DB persistence, no photo filesystem write — those are story-5.3's job.

### Implementation Steps (ordered, TDD-driven)

1. **Documentation pre-work** — fix the broken ADR-007 link in story-5.1.md and nutrition PRD; write new ADR-014 documenting the Gemini choice.
2. **Domain layer** — `nutrition.types.ts` (`AIAnalysisResult`, `FoodItem`, `AnalyzeRequest`, `AnalyzeResponse`), `nutrition.constants.ts` (extract `PhotoRules`, `AIAnalysisRules` from architecture context), `domain/ports/ai-analysis.port.ts` (abstract `AIAnalysisPort`), `domain/errors.ts` (typed errors).
3. **`parseGeminiResponse` helper + tests** — red → green. Pure function: `unknown → AIAnalysisResult`. Handles missing fields, empty `food_items`, malformed JSON. **Anti-pattern 9 target.**
4. **`AnalyzeMealUseCase` + tests** — red → green. Uses `AIAnalysisPort` (injected). Validates `food_items.length >= 1` (architecture invariant). Surfaces `AIUnrecognizedFoodError` for empty results.
5. **`InMemoryAIAnalysisAdapter`** — deterministic adapter for unit/integration tests.
6. **`GeminiVisionAdapter`** — production adapter with `AbortController` timeout + format-aware MIME. **Anti-pattern 6 target.**
7. **`nutrition.composition.ts`** — wires `GeminiVisionAdapter` (prod) → `AnalyzeMealUseCase`. Env-var validation.
8. **`POST /api/nutrition/analyze`** — endpoint. Auth via `getAuthService().getCurrentUser`. Base64 decode + size check + format validation. JSON error envelope.
9. **Endpoint tests** — auth (401), validation (400 with each error code), AI happy path (200), AI timeout (504), AI unrecognized (502), internal error (500).
10. **Static checks** — `pnpm tsc --noEmit` (project-wide, per quarantine learning on signature changes), `pnpm test:run`, `pnpm build` (server endpoints need build verification).

### Selected Skills

- (No additional skills loaded — crew-flow is the workflow skill; project conventions are already documented in the loaded context.)

### Pattern Contracts

- None — no `.pattern.md` for nutrition. **Inferred pattern from `private-photos` (story-4.2):**
  - Abstract port classes (per ADR-011 `implements`, not `extends`).
  - Composition root exports use case singletons (ADR-010).
  - Server endpoints at `src/pages/api/<resource>.ts`, auth-gated, status-coded errors.
  - Tests at `tests/<context>/<file>.test.ts` (project convention from `vitest.config.ts`).
  - Use Object Mothers (per ADR-009) — but only if we need fixtures for DTO construction; the AI port returns the result, we don't construct it from scratch in unit tests.

### Legacy Watchlist

- None (greenfield context).

### Applicable Golden Rules

- **Null policy** — `null` forbidden in domain; absent values are `undefined`. The AI response parser must coerce AI's `null` fields to `undefined` (or validate non-null).
- **Cross-Context Isolation** — `nutrition` context must not write to `auth`, `private-photos`, etc. It calls `getAuthService().getCurrentUser()` for auth only (read-only).
- **Side-Effect Free Reads** — `AnalyzeMealUseCase` does NOT persist anything (per story-5.1 scope). Read-only from the perspective of the DB. AI call is a side effect but at a different boundary.
- **Schema Contracts** — no untyped blobs. `ai_raw_response: Record<string, unknown> | null` is acceptable (it's literally the raw AI output, by design, per architecture context).
- **Test Fixtures** — Object Mothers; never edit existing tests to make them pass.
- **API Design** — input validation at boundary; idempotency not required (POST is intentionally non-idempotent: same image → same AI result, but that's a property of the AI, not the endpoint).
- **Best Practices** — in-memory implementation first (per golden-rules + Alefrank A8 refinement). Use `vi.mock` for `node:fs` if needed (not applicable here — no fs in this story).
- **QA-First Thinking** — write the endpoint test before declaring done; user-facing error strings must match the flow file exactly (per Alefrank A7).

### QA Anti-Patterns (from qa-anti-patterns.md)

- **Relevant categories:**
  - **6 (Error Path Completeness)** — primary focus: AI timeout, unrecognized food, invalid input, missing auth, internal error all map to clean status codes with structured JSON. The catch block on every await is mandatory.
  - **9 (Type-Safety Blind Spots)** — secondary focus: `parseGeminiResponse` is the highest-risk seam. `tsc --noEmit` is mandatory (not just `vitest`). Project already uses Vitest with SWC/esbuild per quarantine learning.
- **NOT relevant:** 1 (silent reversion), 2 (calculation), 3 (state persistence), 4 (UI affordances — no UI), 5 (cascade — no DB), 7 (migration — deferred), 8 (cross-feature — single new context).
- **Self-QA plan (Phase 3 Step 2e):**
  - Category 6: each typed error → response mapping verified by a dedicated endpoint test. `setTimeout` cleared in `finally` (no leaked timers). `AbortController.abort()` called on timeout.
  - Category 9: `tsc --noEmit` after every signature change. Grep for callers of `parseGeminiResponse` before changing its signature. `pnpm build` to catch server-side bundling issues.
- **Fely focus areas:** Manual verification of the actual Gemini response shape against the parser (since we don't have a real Gemini API key in CI — tests use the in-memory adapter + fake fetch). Confirm error strings exactly match `analyze-meal.flow.md:53` wording.

### Verdict

PRESENTED FOR REVIEW — Waiting for user approval.

---

## Alefrank — Plan Ready for Review

### Session Summary

- **Story:** 5.1 — AI Nutrition Analysis Endpoint
- **Description:** Server route `POST /api/nutrition/analyze` that accepts a base64 food photo, calls Gemini 2.5 Flash, returns typed `{total_calories, total_protein, total_carbs, total_fat, food_items[]}` with 30s timeout and clean error envelopes.
- **Specs reviewed:** story-5.1.md, nutrition PRD (FR-NA-001..011), nutrition context architecture (readme.md), analyze-meal.flow.md, ADR-007 (repository pattern, confirmed as drift), ADR-011 (implements-not-extends), Phase 1 readme (no-Supabase rule).
- **Patterns found:** none (no `.pattern.md`); inferred from `private-photos` story-4.2.
- **Gap totals:** DONE: 0 | PARTIAL: 0 | DISCREPANCY: 4 (resolved) | MISSING: 5 | NOT-STARTED: 0
- **Key decisions:** Gemini 2.5 Flash, create ADR-014, format-aware MIME, JSON base64 body, defer schema to 5.3, status codes 400/401/502/504/500.

### Proposed Implementation Plan

17 files total — 12 new (domain + application + infrastructure + endpoint + tests) + 3 modified (story frontmatter, PRD link, new ADR). TDD red → green → regression for the parser and use case. Real Gemini adapter exercised via `FakeGeminiHttpClient` (no network in tests).

### Files Julian will touch

**New:**
- `docs/architecture/decisions/014-ai-nutrition-analysis.md` — new ADR
- `src/lib/contexts/nutrition/domain/nutrition.types.ts`
- `src/lib/contexts/nutrition/domain/nutrition.constants.ts`
- `src/lib/contexts/nutrition/domain/errors.ts`
- `src/lib/contexts/nutrition/domain/ports/ai-analysis.port.ts`
- `src/lib/contexts/nutrition/application/analyze-meal.use-case.ts`
- `src/lib/contexts/nutrition/application/parse-gemini-response.ts`
- `src/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter.ts`
- `src/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter.ts`
- `src/lib/contexts/nutrition/nutrition.composition.ts`
- `src/pages/api/nutrition/analyze.ts`
- `tests/nutrition/parse-gemini-response.test.ts`
- `tests/nutrition/analyze-meal.use-case.test.ts`
- `tests/nutrition/gemini-vision.adapter.test.ts`
- `tests/nutrition/analyze-route.test.ts`

**Modified:**
- `docs/stories/phase-1/round-5/story-5.1.md` — frontmatter `architecture_decisions` cleanup (drop ADR-007, add ADR-010, ADR-011, ADR-014)
- `docs/prd/features/nutrition.md` — fix broken ADR-007 link to point at ADR-014

### Skills Loaded for This Task

- (crew-flow is the active workflow skill; no additional skills applicable.)

### What Julian will do

1. Update docs (`story-5.1.md` frontmatter, PRD link, new ADR-014).
2. Build domain layer (types, constants, port, errors).
3. Write failing test for `parseGeminiResponse` → make it pass.
4. Write failing test for `AnalyzeMealUseCase` → make it pass.
5. Implement `GeminiVisionAdapter` with `AbortController` timeout.
6. Implement `InMemoryAIAnalysisAdapter`.
7. Wire `nutrition.composition.ts`.
8. Implement endpoint with auth + base64 decode + validation + JSON error envelope.
9. Write endpoint tests (401, 400 variants, 200 happy, 504 timeout, 502 unrecognized, 500).
10. Run `pnpm tsc --noEmit` project-wide.
11. Run `pnpm test:run`.
12. Run `pnpm build`.

### What Julian will NOT do

- Create the `nutrition_entries` migration (deferred to story-5.3).
- Save photo to filesystem or DB (deferred to story-5.3).
- Build any UI / Astro page (deferred to story-5.2).
- Wire up Supabase implementations (round-6 territory).
- Add daily summary, calorie goal, or history (story-5.3).
- Touch `auth`, `private-photos`, `progress`, `workout-tracking`, or `public-view` contexts.

### Legacy behaviors being preserved

- None — greenfield context.

---

**Review the plan above. Does this look correct?**

- If yes → type "approve" and Julian will start
- If no → tell me what to change and I'll adjust

---

## User Decision

- **Plan:** Approved (Julian starts).
- **Phase 4 Fely QA:** Approved (full review).

---

**Alefrank:** "Plan approved. Handing off to Julian for implementation. Fely QA will follow Phase 3."

---

## Phase 3 — Julian Implementation

### Tests Written

| File | Tests | Coverage |
|------|-------|----------|
| `tests/nutrition/parse-gemini-response.test.ts` | 13 | Happy path (2), malformed Gemini shapes (8), edge cases (null, string, negative) |
| `tests/nutrition/analyze-meal.use-case.test.ts` | 5 | Happy path (format forwarding), error propagation (unrecognized, timeout, generic) |
| `tests/nutrition/gemini-vision.adapter.test.ts` | 9 | Construction (missing key), happy path (parse, URL, body, MIME mapping), errors (timeout, malformed, empty food items) |
| `tests/nutrition/analyze-route-handler.test.ts` | 14 | Auth (401 missing cookie, 401 invalid session), validation (7 × 400: missing fields, bad format, empty bytes, malformed base64, size exceeded, data-URL mismatch, data-URL match), happy path (200), AI errors (502 unrecognized, 504 timeout, 500 internal) |
| **Total** | **41** | **Full story-5.1 scope** |

### Implementation Changes

**New (13 files):**
- `docs/architecture/decisions/014-ai-nutrition-analysis.md` — ADR documenting Gemini choice
- `src/lib/contexts/nutrition/domain/nutrition.types.ts` — DTOs: `AIAnalysisResult`, `FoodItem`, `AnalyzeRequestBody`, `AnalyzeSuccessResponse`, `AnalyzeErrorResponse`, `PhotoFormat`, `ContentTypes`
- `src/lib/contexts/nutrition/domain/nutrition.constants.ts` — `PhotoRules`, `AIAnalysisRules`, `DATA_URL_PREFIX_PATTERN`, `isValidBase64Payload()`
- `src/lib/contexts/nutrition/domain/errors.ts` — typed errors: `InvalidPhotoError`, `UnauthorizedError`, `AIUnrecognizedFoodError`, `AITimeoutError`, `MissingApiKeyError`, `mapNutritionError()`, `isPhotoFormat()`
- `src/lib/contexts/nutrition/domain/ports/ai-analysis.port.ts` — abstract `AIAnalysisPort` (per ADR-011 `implements`)
- `src/lib/contexts/nutrition/application/parse-gemini-response.ts` — pure function: `unknown → AIAnalysisResult`
- `src/lib/contexts/nutrition/application/analyze-meal.use-case.ts` — thin orchestration
- `src/lib/contexts/nutrition/application/analyze-route-handler.ts` — auth + validation + error mapping (extracted from Astro for testability)
- `src/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter.ts` — production adapter (abort-timeout, format-aware MIME)
- `src/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter.ts` — test double
- `src/lib/contexts/nutrition/nutrition.composition.ts` — wires adapter → use case
- `src/pages/api/nutrition/analyze.ts` — Astro route (thin wrapper)
- `tests/nutrition/*.test.ts` — 4 test files

**Modified (3 files):**
- `docs/stories/phase-1/round-5/story-5.1.md` — `architecture_decisions` updated: dropped `ADR-007`, added `ADR-010`, `ADR-011`, `ADR-014`
- `docs/prd/features/nutrition.md` — replaced broken ADR-007 link with `014-ai-nutrition-analysis.md`
- `docs/architecture/decisions/readme.md` — added ADR-014 row

### Test Results

- New tests: 41/41 passed
- Full suite: 255/255 passed
- Regressions: **none**

### Type Check + Build

- `tsc --noEmit --ignoreDeprecations 5.0`: **clean** (zero errors)
- `astro build`: **clean** (zero errors)

### Self-QA (Anti-Pattern Checks)

| Category | Check | Result | Notes |
|----------|-------|--------|-------|
| 6 (Error Paths) | Loading state reset / catch on every await | PASS | `analyzeRouteHandler` wraps entire pipeline in try/catch. All typed errors map to structured JSON + status code. |
| 6 (Error Paths) | AbortController timeout fires + clears | PASS | `clearTimeout(timeoutId)` runs in `finally`. Timer is never leaked. |
| 6 (Error Paths) | Every API call has user-facing error handling | PASS | 7 validation paths + 3 AI error paths + 1 internal error = 11 error cases, all return `AnalyzeErrorResponse` JSON. |
| 6 (Error Paths) | Network timeout handling | PASS | `AbortController` + 30s timeout + `AITimeoutError` on abort. |
| 9 (Type-Safety) | `tsc --noEmit` after every signature change | PASS | Ran project-wide after all changes. Zero errors. |
| 9 (Type-Safety) | Signature blast radius grep | PASS | `parseGeminiResponse` called in 2 places (adapter + its own test). Both in scope. No other callers. |

### Issues Found & Fixed

1. **Node `Buffer.from(s, 'base64')` is lenient** — silently drops invalid characters. Test `'!!!not-base64!!!'` was decoded to 9 valid bytes (lenient) instead of failing. Fixed by adding `isValidBase64Payload()` O(n) manual alphabet check BEFORE decoding.
2. **Regex `BASE64_PAYLOAD_PATTERN.test()` stack-overflows on large strings** — a 7MB base64 string triggered `RangeError: Maximum call stack size exceeded`. Fixed by replacing regex with manual char-code walk (`isValidBase64Payload()`).
3. **Test fixture `'!!!not-base64!!!'` was too clever** — the chars `[`, `]`, `{` are not in the base64 alphabet but `!` is not either; the string decodes to empty under lenient decoding. Updated to rely on the new strict validation layer.

### Gaps for Fely

- Gemini API key is not available in CI — all adapter tests use `InMemoryAIAnalysisAdapter` or `fetchFn` injection. Real API integration is not covered. Manual verification with a real key + photo would confirm end-to-end works.
- The endpoint is a JSON POST — browser-level testing (CORS, cookie handling, Vercel edge behavior) is out of scope for Vitest. Fely can verify with curl or a manual browser test if desired.
- The error strings for unrecognized food, timeout, and invalid format are pinned in the source code but not validated against `analyze-meal.flow.md` in a test (a string-match test would be brittle). Recommend Fely verify manually that the endpoint returns the exact strings from `analyze-meal.flow.md`.

### Documentation Gaps Found

None — all architecture docs were well-structured and the story spec was clear after the Q1-Q6 decisions.

---

## Phase 4 — Fely QA Review

### Spec Compliance

| AC | Implemented? | Tested? | Notes |
|----|-------------|---------|-------|
| AC-5.1-01: Endpoint accepts photo + returns estimates (FR-NA-003) | ✅ Yes | ✅ Yes | Route handler + use case + adapter tested. 200 happy path verified. |
| AC-5.1-02: Async processing with 30s timeout (FR-NA-004) | ✅ Yes | ✅ Yes | AbortController + 30s timeout. 504 test verifies timeout path. |
| AC-5.1-03: Returns error on unrecognized food (FR-NA-005) | ✅ Yes | ✅ Yes | Empty food_items → `AIUnrecognizedFoodError` → 502 with pinned message. |

### Pattern Compliance

| Pattern Contract | Followed? | Notes |
|-----------------|-----------|-------|
| ADR-010 per-context composition | ✅ Yes | `nutrition.composition.ts` wires adapter → use case. No central root. |
| ADR-011 implements-not-extends | ✅ Yes | `GeminiVisionAdapter implements AIAnalysisPort`. Abstract class is the contract. |
| ADR-014 Gemini choice | ✅ Yes | `AIAnalysisRules.DefaultModel = 'gemini-2.5-flash'`. Env var: `GEMINI_API_KEY`. |
| No Supabase in rounds 1-5 | ✅ Yes | Zero `@supabase/supabase-js` imports. |
| Auth pattern (cookie + getAuthService) | ✅ Yes | Same pattern as `/api/photos.ts`. |
| Endpoint JSON error envelope | ✅ Yes | `AnalyzeErrorResponse { error: string, code: string }` — consistent across all paths. |
| No DB in story-5.1 scope | ✅ Yes | No migration, no repo calls. |

### Test Quality

- 41 nutrition tests cover every code path: happy path (4), validation (7), AI errors (3), auth (2), construction (2), format mapping (3), timeout (1), parse edge cases (13), use-case forwarding (5), adapter (9), route handler (14).
- Tests verify the right behaviors, not just that code compiles. Each 4xx/5xx path is asserted with both `status` and `code` fields.
- `InMemoryAIAnalysisAdapter` provides deterministic, offline test doubles — no mocking of `fetch`, no network.
- **One minor note:** the error message for "size exceeded" shows byte count (`Max 5242880 bytes (got X)`) instead of "5MB" as the flow file states. This is strictly more informative and does not break the AC. **Not a bug.**

### Legacy Behavior

- No legacy behavior affected (greenfield context).
- Existing test suite: 255/255 passed, zero regressions.

### Anti-Pattern Analysis

| Category | Julian Self-QA | Fely Verification | Result |
|----------|---------------|-------------------|--------|
| 6 (Error Paths) | PASS | Verified all 11 error cases return `AnalyzeErrorResponse` JSON. AbortController cleanup in `finally`. No leaked timers. No `set({ status: 'loading' })` without catch. | ✅ PASS |
| 9 (Type-Safety) | PASS | `tsc --noEmit` project-wide: clean. Parser is fully typed (no `any`, no unchecked casts). All response shapes are typed interfaces. | ✅ PASS |

### Issues Found

None.

### Known Bugs Cleanup

- Searched: `**/known-bugs.md` — no such file exists in the project tree.
- Matches removed: N/A.

### Verdict

**PASS** — all ACs verified implemented and tested. No anti-pattern issues. No regressions. No legacy behavior affected. Ready to merge.

> "Dale go mi pana, estamos ready, ahora arreglate conmigo fuera de la terminal"

---

## Phase 5 — Fely Learning Capture

### Distilled Rules

**1. Base64 regex stack overflow on large strings**

> Before validating a base64 payload with `RegExp.test()`, check whether the string can exceed ~5MB. `RegExp.test()` triggers `RangeError: Maximum call stack size exceeded` on long strings due to Node/V8's regex engine stack depth. Use an O(n) manual char-code walk instead. Reason: story 5.1 — `isValidBase64Payload()` was originally a regex (`/^(?:[A-Za-z0-9+/]{4})*.../ `). It stack-overflows on a 7MB base64 string (6MB decoded). Replaced with manual walk; all 14 route handler tests then passed.

- **Scope:** `skill`
- **Destination:** `crew-learnings.md` (skill quarantine) — single confirmation
- **Confidence:** 1
- **Status:** quarantine

**2. `Buffer.from(s, 'base64')` is lenient in Node**

> When validating base64 before decoding, do NOT rely on `Buffer.from(s, 'base64')` to reject invalid characters — Node silently drops them. Validate the alphabet explicitly before decoding. Reason: story 5.1 — the test input `'!!!not-base64!!!'` was decoded to a 9-byte buffer (lenient) instead of failing. The route handler returned 500 (unexpected error) instead of the intended 400 (malformed base64). Fixed by adding `isValidBase64Payload()` with explicit alphabet + length checks BEFORE the `Buffer.from()` call.

- **Scope:** `skill`
- **Destination:** `crew-learnings.md` (skill quarantine) — single confirmation
- **Confidence:** 1
- **Status:** quarantine

### Reinforced / Contradicted

- `before assuming a schema migration is missing for a table` (project quarantine, confidence 1) — **reinforced**: grepped `db/migrations/*.sql` and `_journal.json` for `nutrition` before assuming it was missing. Found it deferred to story-5.3 (correct). No contradiction.
- `before writing import statements in Astro/Vite projects` (skill quarantine, confidence 1) — **reinforced**: used `@/` prefix per `tsconfig.json` + `astro.config.mjs`. All imports correct on first try.
- `story AC conflicts with constraint in a referenced ADR` (skill quarantine, confidence 2) — **reinforced**: story-5.1 referenced `ADR-007` (repository pattern) when it should have referenced `ADR-010/011/014`. Caught in Angel gap analysis. ADR-007 was a broken link to a non-existent file.

No contradictions found.

### Quarantine Hygiene

- **Graduations:** none (all existing quarantine entries below 2 confirmations).
- **Decays:** none (all existing entries have `last-used` within 5 sessions).
- **Re-scopes:** none.

---

**Persist these rules to the skill quarantine `crew-learnings.md`?**

---