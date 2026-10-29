---
story_id: "10.4"
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
  prd_requirements: ["FR-PG-009", "FR-PG-010", "FR-PG-011", "FR-PG-012"]
  architecture_decisions: ["ADR-022"]
  flows: ["readiness-check-in.flow.md"]
blocked_by: ["story-10.2"]
blocks: ["story-12.5"]
---

# Story 10.4 — Readiness Check-in & Muscle Recovery

Parent: [../readme.md](../readme.md)

## Summary

Adapts the session to how the user feels and shows what is recovered. After *Empezar* a 10-second readiness step (sleep, energy, soreness, 1–5) scores the day; a moderate score removes one set per exercise and a low score also lowers the weight by 10 %, for that session only and revertible with *Usar plan original*. The dashboard gains the muscle recovery map and dismissible soft warnings (consecutive days, high volume, fatigued muscle), and the routine picker marks fatigued routines. Closes Gravl rows **G6** and **G7**.

Context: [progression readme](../../../architecture/contexts/progression/readme.md) · Flow: [readiness-check-in.flow.md](../../../architecture/contexts/progression/flows/readiness-check-in.flow.md) · ADR: [ADR-022](../../../architecture/decisions/022-readiness-and-recovery.md) · PRD: [FR-PG-009..012](../../../prd/features/progression.md#fr-pg-009).

## Files in scope

**Modify**

- `src/lib/contexts/progression/application/get-suggestions.use-case.ts` (stories 10.2 / 10.3) — step 6: `applyReadiness` when `context.readinessScore != null`.
- `src/lib/contexts/progression/domain/ports/progression-history.port.ts` + SQLite and Supabase history adapters — add `findMuscleSets` and `findTrainingDays`.
- `src/lib/contexts/progression/progression.composition.ts` — export `submitReadinessUseCase`, `getMuscleRecoveryUseCase`, `getSoftWarningsUseCase`.
- `src/components/live-workout/live-workout.tsx`, `live-workout.reducer.ts`, `workout-header.tsx` — `readiness/submitted` and `readiness/skipped` actions, `ReadinessAdjustedHeader` ("Sesión ajustada: −1 serie" / "Hoy sesión ligera" + *Usar plan original*), `showReadinessStep` condition.
- `src/pages/dashboard.astro` — `RecoveryWidget`, `SoftWarningBanner`, fatigue markers for the next-workout card.
- `src/components/routines/next-workout-card.tsx` (story 8.3) — fatigue marker per routine in *Elegir otra rutina* using the routines' `muscleGroups` ([FR-RT-012](../../../prd/features/routines.md#fr-rt-012)).

**Create**

- Domain (`src/lib/contexts/progression/domain/`): `readiness.ts` (`readinessScore`, `readinessBand`, `applyReadiness`), `recovery.ts` (`computeMuscleRecovery`, `softWarnings`).
- Application (`.../application/`): `submit-readiness.use-case.ts`, `get-muscle-recovery.use-case.ts`, `get-soft-warnings.use-case.ts`.
- UI: `src/components/progression/readiness-step.tsx`, `src/components/progression/recovery-widget.astro`, `src/components/progression/soft-warning-banner.tsx`.
- API: `src/pages/api/progression/readiness.ts` (POST), `src/pages/api/progression/recovery.ts` (GET), `src/pages/api/progression/warnings.ts` (GET).
- Tests: see [Test Plan](#test-plan).

**Not in scope (must not change):** the schema (`readiness_checkins` and `workouts.readiness_score` exist from 7.1 / 10.2), the `ReadinessRepository` implementations (10.2), PR logic, the `readiness_enabled` toggle UI (story 9.4).

## Happy Path

1. The user taps *Empezar* on `/dashboard`. Because `readiness_enabled` is true, the workout has no check-in and no set is completed, the island shows `ReadinessStep` before the exercise list ([FR-PG-009](../../../prd/features/progression.md#fr-pg-009)).
2. The step asks three questions with 1–5 sliders ("¿Cómo dormiste?" Muy mal–Muy bien, "¿Energía hoy?" Agotado–A tope, "¿Agujetas / dolor?" Mucho dolor–Nada). If the routine hits `fatigued` muscles it lists them ("Cuádriceps aún se está recuperando") and offers "Elegir otra rutina".
3. On *Continuar* the island computes `readinessScore` and `applyReadiness` locally (bundled pure modules) so suggestions update instantly, then calls `POST /api/progression/readiness { workoutId, sleep, energy, soreness }`. `SubmitReadinessUseCase` scores `round(avg, 1)`, upserts the check-in, copies the score to `workouts.readiness_score` and returns `{ score, band, suggestions }`; the island replaces its suggestions with the server result.
4. Band `good` (≥ 3.5) changes nothing; `moderate` (2.5–3.4) shows "Sesión ajustada: −1 serie" (−1 working set per exercise, min 1); `low` (< 2.5) shows "Hoy sesión ligera" (−1 set and weight × 0.9, reason `readiness_low`) ([FR-PG-010](../../../prd/features/progression.md#fr-pg-010)).
5. *Usar plan original* swaps every exercise back to `original` (client-only; the stored score stays). *Saltar* closes the step and stores nothing.
6. On `/dashboard`, `RecoveryWidget` shows each muscle trained in the last 7 days with recovery % and state "Recuperado" / "Recuperándose" / "Fatigado" as a front/back silhouette (≥ 400 px) plus a list ([FR-PG-011](../../../prd/features/progression.md#fr-pg-011)). `SoftWarningBanner` shows dismissible warnings ([FR-PG-012](../../../prd/features/progression.md#fr-pg-012)).

## Decisions

- **One check-in per workout.** Re-submitting replaces it; *Saltar* writes nothing (`readiness_score` stays null); *Usar plan original* is client-only and does not clear the score.
- **Deload and low readiness stack.** Order is progression → deload → readiness; `deload` keeps priority as the reason code, a moderate band keeps the original reason.
- **`RecoveryWidget` file.** Built as `recovery-widget.astro` (static, CSS-only front/back toggle) as specified in [components.md](../../../architecture/components.md#recoverywidget); the progression readme lists `recovery-widget.tsx` as an island. Static markup needs no JS, so Astro wins ([phase rule 4](../readme.md#4-islands)).
- **Muscles on the map.** `cardio`, `full_body` and `other` are excluded (no body region); working sets are `normal` + `failure`, like exposures.
- **Soft-warning dismissal.** Stored in `localStorage` under `gymup.warning.<code>.<todayKey>` (wrapped in try/catch); no table, so a dismissed warning returns the next day.
- **Progression off.** The readiness step follows only `readiness_enabled` (FR-PG-013). With `progression_enabled = false` there are no suggestions to adjust, so the adjusted header does not render; the check-in is still stored. (Simplest reading of FR-PG-013.)
- **Offline.** The step is hidden offline (needs `POST`); the session then starts unadjusted.

## Acceptance Criteria

- AC-10.4-01: `readinessScore({sleep, energy, soreness})` = `round((s + e + so) / 3, 1)`: (4,4,3) → 3.7 `good`; (3,3,4) → 3.3 `moderate`; (2,3,2) → 2.3 `low`; band boundaries 2.5 and 3.5 belong to the upper band; an answer that is not an integer 1..5 throws `InvalidReadinessAnswerError`.
- AC-10.4-02: `applyReadiness` leaves `good` untouched, removes one set (minimum 1) for `moderate` with `readinessAdjusted: true`, and for `low` also multiplies the weight by 0.9 rounded to a loadable value with reason `readiness_low`; for duration types the weight is unchanged.
- AC-10.4-03: Stacking: Bench 80×8 ×3, range 5–8, deload and readiness (2,2,2) → `original = { 70, reps: 5, sets: 2, 'deload', readinessAdjusted: false }` and `suggestion = { 62.5, reps: 5, sets: 1, 'deload', isDeload: true, readinessAdjusted: true }` (worked example 6, explanation "Semana de descarga: 1 serie con 62.5 kg × 5 para recuperar.").
- AC-10.4-04: `SubmitReadinessUseCase` stores one `readiness_checkins` row per workout (re-submit replaces it), copies the score to `workouts.readiness_score`, returns `{ score, band, suggestions }`; a foreign workout → 403, an invalid answer → 400, no session → 401.
- AC-10.4-05: The readiness step shows only when `readiness_enabled`, the workout has no check-in and no set is completed; after a reload the stored score yields already-adjusted suggestions and the step does not reappear; with `readiness_enabled = false` it never shows.
- AC-10.4-06: A score < 2.5 reduces sets and weight for that session only; *Usar plan original* restores the original suggestions without clearing the stored score; the next workout is unaffected (round AC-R10-05).
- AC-10.4-07: "Elegir otra rutina" discards the empty in-progress workout without confirmation (no set exists, [FR-WT-038](../../../prd/features/workout-tracking.md#fr-wt-038)) and returns to `/dashboard` with the routine picker open; routines whose primary muscles are `fatigued` carry a marker.
- AC-10.4-08: `computeMuscleRecovery` over the last 7 days uses a 48 h window when the last session had ≤ 10 weighted hard sets and 72 h above (10 vs 10.5), secondary muscles weigh 0.5, `recoveryPct = floor(min(100, hoursSince / window × 100))`, states `fresh` (100), `recovering` (50–99), `fatigued` (< 50), result sorted by `recoveryPct` ascending; example at Thu 18:00: chest (Tue 18:00, 8.5 sets) 100 % `fresh`, quadriceps (Wed 18:00, 12 sets) 33 % `fatigued`, biceps (Wed 06:00, 4 sets) 75 % `recovering`.
- AC-10.4-09: `softWarnings` returns `consecutive_days` when today would be the 4th consecutive training day (3 does not trigger), `high_volume` for muscles above 20 weighted hard sets in 7 days, and `fatigued_muscle` for routine muscles that are `fatigued`; warnings never block an action.
- AC-10.4-10: `/dashboard` renders `RecoveryWidget` consistent with the last 7 days of training (round AC-R10-06) as a silhouette on ≥ 400 px and a list below; dismissing a banner hides it for the rest of the day and survives reload; localStorage failures do not break the page.
- AC-10.4-11: `GET /api/progression/recovery` returns `MuscleRecovery[]`; `GET /api/progression/warnings?routineDayId=…` returns `SoftWarning[]`; both require a session and use only the session user.
- AC-10.4-12: Check-ins are owner-only: SQLite repositories filter `user_id`; the existing `tests/supabase/rls-progression.integration.test.ts` is extended with the submit flow as a non-owner (cannot read or overwrite another user's check-in); no sibling UI renders `readiness_score`.
- AC-10.4-13: Both backends return the same recovery, warnings and submit results for the same fixture; Phase 1 workouts (no secondary muscles data, all `normal` sets) produce a recovery map without error.

## Tasks

- [ ] `T10.4-01` - `readiness.ts` (`readinessScore`, `readinessBand`, `applyReadiness`) with tests (score rounding, band boundaries, minimum 1 set, stacking with deload).
- [ ] `T10.4-02` - `recovery.ts` (`computeMuscleRecovery`, `softWarnings`) with tests (48 / 72 h windows, secondary 0.5, state boundaries 50 / 100, 7-day lookback, excluded muscles, 3 vs 4 consecutive days, > 20 sets).
- [ ] `T10.4-03` - Extend `ProgressionHistoryPort` with `findMuscleSets` and `findTrainingDays` (SQLite + Supabase; local day keys in `profiles.timezone`).
- [ ] `T10.4-04` - Extend `GetSuggestionsUseCase` with step 6 (`applyReadiness`); worked example 6 end to end.
- [ ] `T10.4-05` - `SubmitReadinessUseCase` (uses `ReadinessRepository.upsertForWorkout`), `GetMuscleRecoveryUseCase`, `GetSoftWarningsUseCase`; use-case tests on real SQLite (copy to `workouts.readiness_score`, owner guard).
- [ ] `T10.4-06` - Composition exports; API `POST /api/progression/readiness`, `GET /api/progression/recovery`, `GET /api/progression/warnings`.
- [ ] `T10.4-07` - `ReadinessStep` (three sliders ≥ 44 px thumb, *Saltar*, fatigued list, "Elegir otra rutina") and reducer actions `readiness/submitted` / `readiness/skipped`; recompute prefill of untouched rows.
- [ ] `T10.4-08` - `ReadinessAdjustedHeader` + *Usar plan original* in `workout-header.tsx`.
- [ ] `T10.4-09` - `RecoveryWidget` (inline SVG front/back, CSS-only toggle, text list) and `SoftWarningBanner` (dismiss via localStorage) on `/dashboard`.
- [ ] `T10.4-10` - Fatigue marker in the routine picker (`next-workout-card.tsx`) using `muscleGroups`.
- [ ] `T10.4-11` - RLS extension for check-ins, cross-backend and Phase 1 regression checks.
- [ ] `T10.4-12` - Update docs: mark context Use Cases rows (`SubmitReadinessUseCase`, `GetMuscleRecoveryUseCase`, `GetSoftWarningsUseCase`) `implemented`, fix any doc/code drift found (e.g. `recovery-widget` file extension), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/progression/readiness.test.ts` | unit (pure, table-driven) | score rounding, bands, minimum 1 set, deload stacking (01–03) |
| `tests/progression/recovery.test.ts` | unit (pure, table-driven) | windows, weights, state boundaries, lookback, exclusions; `softWarnings` 3 vs 4 days, > 20 sets (08, 09) |
| `tests/progression/progression-engine.test.ts` (extended) | unit | worked example 6 final suggestion (03) |
| `tests/progression/submit-readiness.use-case.test.ts` | use-case (real SQLite) | one check-in per workout, replace on re-submit, score copied to `workouts.readiness_score`, foreign workout, invalid answers (04, 12) |
| `tests/progression/get-muscle-recovery.use-case.test.ts`, `get-soft-warnings.use-case.test.ts` | use-case | recovery from real sets, routine fatigue, consecutive days via timezone keys (08–10, 13) |
| `tests/progression/readiness-step.test.tsx` | component | conditions to show the step, skip, revert, client-side adjustment (05–07) |
| `tests/progression/recovery-widget.test.ts` | component / render | list and silhouette states, dismissed banner (10) |
| `tests/supabase/rls-progression.integration.test.ts` (extended) | integration-RLS (gated) | non-owner cannot read or overwrite another user's check-in (12) |

Mothers: reuse `ExposureMother`, `ExerciseMetaMother`; add `MuscleSetMother.hardSets(muscle, count, { hoursAgo, secondary? })` in `tests/progression/mothers/`.

## Out of Scope

- Plateau and deload logic → story 10.3.
- Weekly average readiness in the AI summary → story 11.4 (reads `getReadinessAverage`).
- Muscle distribution statistics (weekly sets per muscle) → story 11.2.
- Offline queue for the readiness POST → story 12.3.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
