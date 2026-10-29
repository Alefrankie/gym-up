---
story_id: "10.2"
round: "round-10"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/progression/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progression", "workout-tracking"]
  prd_requirements: ["FR-PG-001", "FR-PG-002", "FR-PG-003", "FR-PG-004", "FR-PG-005", "FR-PG-013"]
  architecture_decisions: ["ADR-021"]
  flows: ["suggest-next-load.flow.md"]
blocked_by: ["story-9.2"]
blocks: ["story-10.3", "story-10.4"]
---

# Story 10.2 — Load Suggestions (Double Progression)

Parent: [../readme.md](../readme.md)

## Summary

Adds the Gravl "what do I lift next" engine: migration 007 (override and readiness tables plus the deload columns of `profiles`), the pure double-progression functions, the real `SuggestionPort` adapter that replaces the Round 9 no-op, `SuggestionChip` and `SuggestionWhySheet` in the live workout, and the FR-WT-030 prefill priority 1. With `progression_enabled = false` the app behaves as plain Hevy. Closes Gravl row **G3** of the [phase exit criteria](../readme.md#exit-criteria--hevy--gravl-parity) (plateau, deload and readiness land in 10.3 and 10.4).

Context: [progression readme](../../../architecture/contexts/progression/readme.md) · Flow: [suggest-next-load.flow.md](../../../architecture/contexts/progression/flows/suggest-next-load.flow.md) · Schema: [007 — Progression](../../../architecture/database-schema.md#007--progression-adr-021-adr-022) · PRD: [FR-PG-001..005, 013](../../../prd/features/progression.md#fr-pg-001).

## Files in scope

**Modify**

- `db/schema.ts` — add `exerciseProgressionOverrides`, `readinessCheckins` and the `profiles` columns `deloadUntil`, `lastDeloadAt`, `deloadSnoozedUntil`; export `ExerciseProgressionOverride`, `ReadinessCheckin` (and `New…`) types.
- `db/migrations/` — `0007_progression.sql` plus `meta/` from `drizzle-kit generate`.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — replace `NoSuggestionAdapter` with the progression `suggestionPort`.
- `src/components/live-workout/exercise-block.tsx` — render `SuggestionChip` under the exercise name; open `SuggestionWhySheet`.
- `src/components/live-workout/live-workout.reducer.ts` — prefill priority 1 from `suggestions[exerciseId]` (FR-WT-030), muted style, cleared on edit; keep `exercise/context-loaded` merging `suggestions`.
- `docs/` is updated only in the last task.

**Create**

- `supabase/migrations/007_progression.sql` — DDL, `ENABLE ROW LEVEL SECURITY`, policies `progression_overrides_own` and `readiness_checkins_own` (idempotent, `IF NOT EXISTS`).
- `src/lib/health-safety/health-safety.constants.ts` — `HealthRules` as written in [system.md](../../../architecture/system.md) (does not exist in code today, [phase rule 2](../readme.md#2-code-is-the-source-of-truth-for-conventions)).
- Domain (`src/lib/contexts/progression/domain/`): `progression.types.ts`, `progression.constants.ts`, `progression-engine.ts`, `explain-suggestion.ts`, `errors.ts` (declares all three error classes), `progression-override.repository.ts`, `readiness.repository.ts`, `ports/progression-history.port.ts`, `ports/progression-profile.port.ts`, `ports/suggestion.port.ts`.
- Application (`.../application/`): `get-suggestions.use-case.ts`, `explain-suggestion.use-case.ts`, `progression-suggestion.service.ts` (`ProgressionSuggestionService implements SuggestionPort`).
- Infrastructure: `sqlite/` and `supabase/` — `…-progression-history.adapter.ts`, `…-progression-override.repository.ts`, `…-readiness.repository.ts`, `…-progression-profile.adapter.ts`.
- `src/lib/contexts/progression/progression.composition.ts`.
- UI: `src/components/progression/suggestion-chip.tsx`, `src/components/progression/suggestion-why-sheet.tsx`.
- API: `src/pages/api/progression/suggestions.ts`, `src/pages/api/progression/suggestions/[exerciseId]/explanation.ts`.
- Tests and mothers: see [Test Plan](#test-plan).

**Not in scope (must not change):** workout history columns, `workouts.is_deload` / `readiness_score` semantics (columns come from 7.1), Phase 1 routines and `progress` code.

## Happy Path

1. The user taps *Empezar*; `/workout/[id]` SSR loads the workout (`routineDayId`, `isDeload`, `readinessScore`) and its exercise ids through workout-tracking use cases, then calls `suggestionPort.getSuggestions(userId, exerciseIds, { routineDayId, isDeload, readinessScore })` ([FR-PG-001](../../../prd/features/progression.md#fr-pg-001)).
2. `GetSuggestionsUseCase` loads profile settings, exercise metadata (`ExerciseCatalogPort`), routine targets (`RoutinePlanPort`), overrides and the completed working sets (`ProgressionHistoryPort`), then per exercise runs `buildExposures` → `resolveRepRange` → `suggestNext` → `explainSuggestion`.
3. The island receives `ExerciseSuggestion[]`. Each exercise shows "Sugerido: 62.5 kg × 8" and its rows are prefilled in a muted style ([FR-WT-030](../../../prd/features/workout-tracking.md#fr-wt-030) priority 1).
4. The user taps the chip; `SuggestionWhySheet` shows "¿Por qué?" with the sentence "La última vez hiciste 12, 12 y 12 reps con 60 kg (tope del rango 8–12). Subimos 2.5 kg." No network call ([FR-PG-002](../../../prd/features/progression.md#fr-pg-002)).
5. A first exposure shows no suggestion; the chip reads "Primera vez: elige un peso con el que llegues a 8–12 reps con 2 en reserva" ([FR-PG-005](../../../prd/features/progression.md#fr-pg-005)). Distance types show no chip.
6. For an exercise added mid-workout the island calls `GET /api/progression/suggestions?exerciseIds=…&workoutId=…`.
7. With `progression_enabled = false` every suggestion is `null`, no chip appears and prefill falls back to *Anterior* ([FR-PG-013](../../../prd/features/progression.md#fr-pg-013)).

## Decisions

- **Slicing of `GetSuggestionsUseCase`.** This story implements orchestration steps 1–3 and 8 of the readme (profile gate, loading, exposures, range, `suggestNext`, explanation). `original = suggestion`, `plateaued = false` until 10.3, and `context.isDeload` / `context.readinessScore` are accepted but not applied until 10.3 (deload, rebuild) and 10.4 (readiness). `ReasonCode`, `Suggestion` and `ExerciseSuggestion` are the complete types from day one.
- **Explanation templates.** `explain-suggestion.ts` ships every template row (including `plateau_rebuild`, `deload`, `readiness_low`) because the `ReasonCode` union is complete; 10.3 and 10.4 exercise them end to end.
- **Persistence ownership.** The story that adds a migration owns the repositories of its tables: `ProgressionOverrideRepository` (`findByExercises`, `upsert`, `delete`), `ReadinessRepository` (`findByWorkout`, `upsertForWorkout`, `listBetween`) and `ProgressionProfilePort` (`findProfile`, `updateDeloadState`) with both backends and the RLS test. 10.3 and 10.4 only add use cases. This also lets 11.4 (blocked by 10.3) read readiness averages. `ProgressionHistoryPort` methods are added by the story that needs them (`findCompletedSets`, `findWorkoutContext` here; `findProgramExerciseIds`, `findFirstProgramWorkoutAt` in 10.3; `findMuscleSets`, `findTrainingDays` in 10.4).
- **`HealthRules` vs copied constants.** The progression readme copies the HealthRules values into `SafetyCaps`, `RecoveryRules` and `SoftWarningRules`. This story keeps those copies (each commented with its HealthRules key) and adds a unit test asserting they equal `HealthRules`, so the two cannot drift. (Simplest; no import coupling.)
- **`isDeloadActive` when progression is off.** Returns `false` when `progression_enabled = false` (pure Hevy mode, round AC-R10-07); with it on it reads `profiles.deload_until`.
- **Weights are advice.** The user can log any value; safety caps apply to suggestions only ([ADR-016 §5](../../../architecture/decisions/016-workout-data-model-v2.md)).
- **Prefill.** Prefilled rows use the suggestion's `sets` working rows; in a free workout `sets` is the number of working sets of the last exposure (Hevy repeats the previous session).

## Acceptance Criteria

- AC-10.2-01: Migration 007 exists for both backends (`db/migrations/0007_progression.sql`, `supabase/migrations/007_progression.sql`), is idempotent on Supabase, creates `exercise_progression_overrides` (PK `(user_id, exercise_id)`), `readiness_checkins` (index `idx_readiness_user`) and the `profiles` columns `deload_until`, `last_deload_at`, `deload_snoozed_until`.
- AC-10.2-02: `src/lib/health-safety/health-safety.constants.ts` exports `HealthRules`, and `SafetyCaps`, `RecoveryRules.BaseWindowH` and `SoftWarningRules` equal their HealthRules counterparts (test).
- AC-10.2-03: `suggestNext` follows the decision table rows 0–9 of the readme (no exposure → `null`; distance types → `null`; duration +5 s; assisted; rep-only; weight increase / hold / reduce after two misses; RPE ≥ 9.5 blocks an increase).
- AC-10.2-04: Worked example 1 (Bench 60×12,12,12, range 8–12, 3 sets) returns `{ weight: 62.5, reps: 8, sets: 3, reason: 'increase_all_sets_hit_max' }` and the explanation "La última vez hiciste 12, 12 y 12 reps con 60 kg (tope del rango 8–12). Subimos 2.5 kg." verbatim; examples 2–5 and 7–12 produce the expected weight, reps, sets and reason.
- AC-10.2-05: Increments follow the `IncrementTable` by equipment, muscle side and unit (lbs users get unit-native steps; dumbbells below 10 kg step 1 kg), barbell results are loadable with the user's bar and plates, and no increase exceeds `min(5 kg, 10 % × W)` (at least one step); when no loadable increase fits the cap the suggestion holds the weight at `max` reps with the "añade discos más pequeños" explanation (example 12).
- AC-10.2-06: Rep range resolves override → routine target → default (compound barbell 5–8, other 8–12); in a free workout `sets` equals the working sets of the last exposure; the same exercise twice in one workout forms one exposure.
- AC-10.2-07: Only completed sets of completed workouts with `set_type ∈ {normal, failure}` feed the engine; warm-ups and drops are ignored; deleted workouts never count.
- AC-10.2-08: `GET /api/progression/suggestions` returns `ExerciseSuggestion[]` for the workout's context; a workout of another user → 403; no session → 401. `GET /api/progression/suggestions/[exerciseId]/explanation` returns `{ explanation, suggestion, repRange }`.
- AC-10.2-09: The live workout shows the chip "Sugerido: 62.5 kg × 8" (plus "· 2 series" when `sets` differs from the routine), prefills the rows with suggested weight and reps, and `SuggestionWhySheet` opens offline from props; a first exposure shows the FR-PG-005 hint and distance types show no chip.
- AC-10.2-10: With `progression_enabled = false`, every item has `suggestion`, `original`, `explanation`, `firstTimeHint` = `null` and `plateaued: false`, no chip renders and prefill uses *Anterior*; with it on again the chips return.
- AC-10.2-11: `ProgressionSuggestionService` replaces the no-op: `getSuggestions` and `isDeloadActive` are served by progression through `workout-tracking.composition.ts`; both backends return identical suggestions for the same fixture (`STORAGE_BACKEND=sqlite|supabase`).
- AC-10.2-12: RLS: as a non-owner, `select`, `insert` and `update` on another user's `exercise_progression_overrides` and `readiness_checkins` fail or return nothing (`tests/supabase/rls-progression.integration.test.ts`); the SQLite repositories filter `user_id` on every query (user B cannot read or write user A's rows).
- AC-10.2-13: Phase 1 regression: migration 007 applied to `tests/fixtures/phase-1.db` leaves history, `/progress` points and streak unchanged, and `GetSuggestionsUseCase` over Phase 1 workouts (all `normal` sets) returns suggestions without error.

## Tasks

- [ ] `T10.2-01` - `db/schema.ts` tables and columns, `drizzle-kit generate` (`0007_progression.sql`), `supabase/migrations/007_progression.sql` with RLS; migration test on the Phase 1 fixture.
- [ ] `T10.2-02` - Create `src/lib/health-safety/health-safety.constants.ts` (`HealthRules`) and the equality test for the copied constants.
- [ ] `T10.2-03` - `progression.types.ts`, `progression.constants.ts`, `errors.ts` (`InvalidReadinessAnswerError`, `ExerciseNotPlateauedError`, `UnknownPlateauOptionError`).
- [ ] `T10.2-04` - `progression-engine.ts`: `toDisplayWeight`, `fromDisplayWeight`, `topWorkingWeight`, `incrementFor`, `roundToLoadable`, `applySafetyCaps`, `buildExposures`, `resolveRepRange`, `suggestNext`, `increaseWeight`; table-driven tests (rows 0–9, examples 1–5, 7–12).
- [ ] `T10.2-05` - `explain-suggestion.ts` (`explainSuggestion`, `firstTimeHint`, `formatWeight`, `formatRepsList`) with one assertion per template row.
- [ ] `T10.2-06` - Ports and repositories: `ProgressionHistoryPort` (`findCompletedSets`, `findWorkoutContext`), `ProgressionOverrideRepository`, `ReadinessRepository`, `ProgressionProfilePort` with SQLite implementations (owner guard `where user_id = ?`) and repo tests.
- [ ] `T10.2-07` - Supabase implementations of the same ports (`workouts!inner` filters; `upsertForWorkout` in two statements) and `rls-progression.integration.test.ts` as a non-owner.
- [ ] `T10.2-08` - `GetSuggestionsUseCase` (steps 1–3, 8), `ExplainSuggestionUseCase`, `ProgressionSuggestionService`; use-case tests on real SQLite (free vs routine range, override range, progression disabled).
- [ ] `T10.2-09` - `progression.composition.ts` (`resolveStorageBackend`, `buildXxx(backend)`, exports `getSuggestionsUseCase`, `explainSuggestionUseCase`, `suggestionPort`, `progressionBackend`); swap the null adapter in `workout-tracking.composition.ts`.
- [ ] `T10.2-10` - API endpoints `/api/progression/suggestions` and `/api/progression/suggestions/[exerciseId]/explanation` (session user only, 401/403).
- [ ] `T10.2-11` - `SuggestionChip` and `SuggestionWhySheet`; mount in `exercise-block.tsx`; hint and no-chip rules.
- [ ] `T10.2-12` - Activate FR-WT-030 prefill priority 1 in the reducer; mid-workout `exercise/context-loaded` path; `progression_enabled = false` fallback to *Anterior*.
- [ ] `T10.2-13` - Update docs: mark context Use Cases rows (`GetSuggestionsUseCase`, `ExplainSuggestionUseCase`) `implemented`, fix any doc/code drift found (e.g. `HealthRules` note in the phase readme), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/progression/progression-engine.test.ts` | unit (pure, table-driven) | decision-table rows 0–9, worked examples 1–5 and 7–12, every increment (equipment × side × unit), `roundToLoadable`, `applySafetyCaps`, `topWorkingWeight` ties (03–06) |
| `tests/progression/explain-suggestion.test.ts` | unit | one assertion per template row; FR-PG-002 sentence verbatim (04) |
| `tests/progression/health-rules.test.ts` | unit | constants equal `HealthRules` (02) |
| `tests/progression/get-suggestions.use-case.test.ts` | use-case (real SQLite) | free vs routine range, override range, progression disabled, ignored set types, double exposure (06, 07, 10) |
| `tests/progression/sqlite-progression-repositories.test.ts` | repo | owner guard on overrides and check-ins, history query (07, 12) |
| `tests/progression/progression-suggestion.service.test.ts` | use-case | `suggestionPort` + `isDeloadActive` through the composition (11) |
| `tests/progression/progression-migration.test.ts` | integration (SQLite) | tables and columns exist; Phase 1 fixture unchanged (01, 13) |
| `tests/progression/suggestion-chip.test.tsx` | component | chip text, hint, no chip for distance types, why sheet from props (09) |
| `tests/supabase/rls-progression.integration.test.ts` | integration-RLS (gated) | non-owner cannot select, insert or update both tables (12) |

Mothers (`tests/progression/mothers/`): `ExposureMother.sets(weight, reps[], { rpe?, daysAgo?, isDeload? })`, `ExerciseMetaMother` (`.barbellChest()`, `.barbellSquat()`, `.machineLegPress()`, `.dumbbellShoulders()`, `.pullUp()`, `.plank()`, `.treadmill()`), `LoadContextMother` (`.kgDefault()`, `.lbsDefault()`), `ProgressionOverrideMother`; `tests/progression/test-db.ts` re-exports the workout-tracking harness.

## Out of Scope

- Plateau detection, "Estancado" marker, `PlateauSheet`, deload cards and `applyDeload` → story 10.3.
- Readiness step, `applyReadiness`, recovery map and soft warnings → story 10.4.
- `ProgressionInsightsPort` for the weekly summary → story 10.3 (plateaus and deload) and story 11.4 (consumer).
- "Sugerencia sin conexión" cache and offline behaviour → story 12.3.
- The `progression_enabled` / `readiness_enabled` toggles themselves → story 9.4 (training settings).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
