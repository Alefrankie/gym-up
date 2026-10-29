---
story_id: "10.3"
round: "round-10"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/progression/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progression"]
  prd_requirements: ["FR-PG-006", "FR-PG-007", "FR-PG-008"]
  architecture_decisions: ["ADR-021"]
  flows: ["plateau-and-deload.flow.md"]
blocked_by: ["story-10.1", "story-10.2"]
blocks: ["story-11.4"]
---

# Story 10.3 — Plateau Detection & Deload Week

Parent: [../readme.md](../readme.md)

## Summary

Adds the coach's response to stalls. An exercise whose best e1RM (best reps for rep-only types) has not improved over its last three non-deload exposures is marked "Estancado" and offers three options (*Bajar y reconstruir*, *Cambiar rango*, *Ignorar*). When the deload conditions of [ADR-021 §6](../../../architecture/decisions/021-progression-engine.md) hold, the dashboard recommends a deload week; accepting it makes the next 7 days use 60 % sets and 90 % weight with a "Descarga" badge. Also exports `ProgressionInsightsPort` for the weekly summary (story 11.4). Closes Gravl rows **G4** and **G5**.

Context: [progression readme](../../../architecture/contexts/progression/readme.md) · Flow: [plateau-and-deload.flow.md](../../../architecture/contexts/progression/flows/plateau-and-deload.flow.md) · PRD: [FR-PG-006..008](../../../prd/features/progression.md#fr-pg-006).

## Files in scope

**Modify**

- `src/lib/contexts/progression/application/get-suggestions.use-case.ts` (story 10.2) — add steps 4–7: rebuild when `isRebuildActive`, `applyDeload` when `context.isDeload`, set `original`, compute `plateaued`.
- `src/lib/contexts/progression/domain/ports/progression-history.port.ts` + the SQLite and Supabase history adapters — add `findProgramExerciseIds` and `findFirstProgramWorkoutAt`.
- `src/lib/contexts/progression/progression.composition.ts` — export `getPlateausUseCase`, `resolvePlateauUseCase`, `getDeloadRecommendationUseCase`, `startDeloadUseCase`, `snoozeDeloadUseCase`, `endDeloadUseCase`, `progressionInsightsPort`.
- `src/components/progression/suggestion-chip.tsx` and `suggestion-why-sheet.tsx` (10.2) — amber "Estancado" marker, "Descarga" badge, link "Opciones de estancamiento".
- `src/components/live-workout/exercise-block.tsx` — open `PlateauSheet` from the chip.
- `src/pages/dashboard.astro` — `DeloadCard`, `PlateauList`, chip "Descarga activa hasta {fecha}"; all hidden when `progression_enabled = false`.
- `src/pages/exercises/[id].astro` (story 7.3) — "Estancado" marker + *Opciones* (`PlateauSheet`, `client:visible`).
- `src/pages/settings.astro` — "Descarga activa hasta {fecha}" + *Terminar descarga*.

**Create**

- Domain (`src/lib/contexts/progression/domain/`): `plateau.ts` (`detectPlateau`, `isPlateauSuppressed`, `isRebuildActive`, `alternateRange`), `deload.ts` (`recommendDeload`, `applyDeload`).
- Application (`.../application/`): `get-plateaus.use-case.ts`, `resolve-plateau.use-case.ts`, `get-deload-recommendation.use-case.ts`, `start-deload.use-case.ts`, `snooze-deload.use-case.ts`, `end-deload.use-case.ts`, `progression-insights.service.ts` (`ProgressionInsightsService implements ProgressionInsightsPort`).
- Domain port: `domain/ports/progression-insights.port.ts`.
- UI: `src/components/progression/plateau-sheet.tsx`, `src/components/progression/deload-card.astro`, `src/components/progression/plateau-list.astro`.
- API: `src/pages/api/progression/plateaus.ts` (GET), `src/pages/api/progression/plateaus/[exerciseId].ts` (POST), `src/pages/api/progression/deload/start.ts`, `snooze.ts`, `end.ts`.
- Tests: see [Test Plan](#test-plan).

**Not in scope (must not change):** the schema (migration 007 ships in 10.2), `workouts.is_deload` column, PR logic (a deload workout still produces PRs, [ADR-020](../../../architecture/decisions/020-personal-records.md)).

## Happy Path

1. The user completes the 4th non-deload exposure of Bench Press without beating the best e1RM recorded before the last three exposures. On the next workout load `detectPlateau` returns `plateaued: true`, `suppressed: false`.
2. The chip gets an amber "Estancado" marker; the exercise detail page and the dashboard list "Ejercicios estancados" show it too ([FR-PG-006](../../../prd/features/progression.md#fr-pg-006)).
3. The user opens `PlateauSheet` and picks one option ([FR-PG-007](../../../prd/features/progression.md#fr-pg-007)): *Bajar y reconstruir* (default) → next suggestion is `W × 0.9` at `range.min`, reason `plateau_rebuild`; *Cambiar rango* → the range flips (5–8 ↔ 8–12) for 28 days; *Ignorar* → the marker is hidden for 2 exposures. The choice goes to `exercise_progression_overrides`.
4. After 6 weeks since the last deload with ≥ 3 plateaued exercises of the active program (or 8 weeks regardless), the dashboard shows "Semana de descarga recomendada" with the reason ([FR-PG-008](../../../prd/features/progression.md#fr-pg-008)).
5. *Empezar descarga* sets `deload_until = today + 7`, `last_deload_at = today`. Workouts started while `today < deload_until` get `is_deload = true` (via `SuggestionPort.isDeloadActive`), show the "Descarga" badge and the reduced suggestions: `sets = max(1, round(target × 0.6))`, weight × 0.9 rounded to a loadable value, reps = range min.
6. *Ahora no* hides the card for 7 days. `/settings` shows "Descarga activa hasta {fecha}" with *Terminar descarga* (`deload_until = null`, `last_deload_at` kept).
7. `ProgressionInsightsPort` returns plateaus, deload status and readiness average for the weekly summary.

## Decisions

- **Deload count ignores `suppressed`.** `recommendDeload` counts exercises that are `plateaued`, even if the user chose *Ignorar* (fatigue is program-wide).
- **Suppression is read, not decremented.** `dismissed_until_exposures` counts exposures completed after `updated_at`; *Ignorar* stores 2, *Bajar y reconstruir* and *Cambiar rango* store 3; `rebuild_pending` becomes inert after the next exposure and is never cleared on read.
- **`alternateRange`.** From a non-standard range (e.g. 6–10) *Cambiar rango* goes to 8–12 when `max ≤ 8`, else 5–8.
- **Progression off.** `getDeloadRecommendation` returns `status: 'none'`, `getPlateaus` returns `[]`, and `isDeloadActive` is `false` when `progression_enabled = false`; no card, list or marker renders (round AC-R10-07).
- **Sheet is online-only.** `POST /api/progression/plateaus/[exerciseId]` needs the network; the sheet is disabled offline with "Necesita conexión" (components.md).
- **Readiness reads for 11.4.** `ProgressionInsightsService.getReadinessAverage` uses `ReadinessRepository.listBetween` shipped in 10.2; with no check-ins it returns `{ average: null, count: 0 }`.
- **Calendar.** Deload days are visible in the month calendar by story 11.2 through `workouts.is_deload`; nothing to build here.

## Acceptance Criteria

- AC-10.3-01: `detectPlateau` returns `plateaued: false` with fewer than 4 non-deload exposures, ignores deload exposures in the window, treats an equal best as a plateau and any improvement as not a plateau, uses best reps for `bodyweight_reps` / `assisted_bodyweight`, and never flags `duration`, `distance_duration`, `weight_distance`.
- AC-10.3-02: After three exposures without e1RM improvement the exercise is marked "Estancado" on the chip, on `/exercises/[id]` and in the dashboard list "Ejercicios estancados" (shown only when ≥ 1) (round AC-R10-03).
- AC-10.3-03: `ResolvePlateauUseCase` with `rebuild` upserts `{ rebuildPending: true, dismissedUntilExposures: 3 }`; `change_range` upserts the alternate range with `rangeUntil = today + 28` and `dismissedUntilExposures: 3`; `ignore` upserts `{ dismissedUntilExposures: 2 }` keeping an active range; every upsert sets `updatedAt = now`.
- AC-10.3-04: Resolving an exercise that is not plateaued → `ExerciseNotPlateauedError` (409); an unknown option → `UnknownPlateauOptionError` (400); no session → 401; the user id comes from the session.
- AC-10.3-05: After *Bajar y reconstruir* the next suggestion is `{ weight: roundToLoadable(W × 0.9), reps: range.min, reason: 'plateau_rebuild' }` (worked example 13: 60 kg → 52.5 kg × 8); after the next exposure the rebuild is inert; after *Ignorar* the marker disappears until two more exposures; after *Cambiar rango* the range of the suggestion and the chip show the new range for 28 days.
- AC-10.3-06: `recommendDeload` returns `recommended` / `plateaus_after_6_weeks` at 7 weeks with 3 plateaued program exercises, `none` with 2, `recommended` / `eight_weeks` at 8 weeks, `active` while `today < deload_until`, `none` while snoozed, and `none` when there is no anchor (`last_deload_at` or first completed program workout).
- AC-10.3-07: `applyDeload` sets `sets = max(1, round(base.sets × 0.6))` (2→1, 3→2, 4→2, 5→3), weight × 0.9 rounded to a loadable value for weight types, reps = `range.min`, duration without the +5 s rule, `reason: 'deload'`, `isDeload: true`; worked example 6 `original` is `{ 70, reps: 5, sets: 2, 'deload' }` for Bench 80×8 ×3, range 5–8 (the readiness-adjusted `suggestion` is covered by story 10.4).
- AC-10.3-08: `StartDeloadUseCase` sets `deload_until = today + 7`, `last_deload_at = today`, clears `deload_snoozed_until`, and is idempotent while a deload is active; `SnoozeDeloadUseCase` sets `deload_snoozed_until = today + 7`; `EndDeloadUseCase` sets `deload_until = null` and keeps `last_deload_at`. Dates are local dates in `profiles.timezone`.
- AC-10.3-09: A workout started while `today < deload_until` has `is_deload = true`, shows the "Descarga" badge and reduced suggestions (round AC-R10-04); a workout started after the deload ends does not; PRs still count in a deload workout.
- AC-10.3-10: The deload card shows the reason text ("Llevas 7 semanas sin descarga y 3 ejercicios estancados" / "Llevas 8 semanas sin descarga") with **Empezar descarga** / **Ahora no** as form posts (303 to `/dashboard`); `/settings` shows "Descarga activa hasta {fecha}" and *Terminar descarga* (303 to `/settings`).
- AC-10.3-11: With `progression_enabled = false` no "Estancado" marker, plateau list, deload card or "Descarga" badge renders and no deload is recommended (round AC-R10-07).
- AC-10.3-12: `ProgressionInsightsPort` (`listPlateaus` = plateaued and not suppressed, `getDeloadStatus`, `getReadinessAverage`) works on both backends and is exported as `progressionInsightsPort`.
- AC-10.3-13: Both backends (`STORAGE_BACKEND=sqlite|supabase`) give the same plateau and deload results for the same fixture; `exercise_progression_overrides` writes by a non-owner are rejected (re-using `rls-progression.integration.test.ts`, extended with the resolve flow); Phase 1 workouts (no deload, all `normal` sets) still render and a Phase 1 user with ≥ 4 exposures can be flagged without breaking history.

## Tasks

- [ ] `T10.3-01` - `plateau.ts` (`detectPlateau`, `isPlateauSuppressed`, `isRebuildActive`, `alternateRange`) with table-driven tests (< 4 exposures, deload excluded, equal best, rep-only metric, suppression counts 2 / 3).
- [ ] `T10.3-02` - `deload.ts` (`recommendDeload`, `applyDeload`) with tests (6 w + 3, 6 w + 2, 8 w, active, snoozed, no anchor; set rounding 2→1, 3→2, 4→2, 5→3).
- [ ] `T10.3-03` - Extend `ProgressionHistoryPort` with `findProgramExerciseIds` and `findFirstProgramWorkoutAt` (SQLite + Supabase).
- [ ] `T10.3-04` - Extend `GetSuggestionsUseCase`: rebuild, `applyDeload`, `original`, `plateaued`; worked examples 6 (`original`) and 13.
- [ ] `T10.3-05` - `GetPlateausUseCase`, `ResolvePlateauUseCase`, `GetDeloadRecommendationUseCase` with use-case tests on real SQLite.
- [ ] `T10.3-06` - `StartDeloadUseCase`, `SnoozeDeloadUseCase`, `EndDeloadUseCase` via `ProgressionProfilePort.updateDeloadState`; test that a started workout gets `is_deload` through `suggestionPort.isDeloadActive`.
- [ ] `T10.3-07` - `ProgressionInsightsPort` + `ProgressionInsightsService`; composition exports.
- [ ] `T10.3-08` - API: `GET /api/progression/plateaus`, `POST /api/progression/plateaus/[exerciseId]`, `POST /api/progression/deload/{start,snooze,end}`.
- [ ] `T10.3-09` - Chip "Estancado" + "Descarga" badge, `PlateauSheet`, wire into `exercise-block.tsx` and `/exercises/[id]`.
- [ ] `T10.3-10` - `DeloadCard`, `PlateauList` and the active-deload chip on `/dashboard`; "Descarga activa" + *Terminar descarga* on `/settings`.
- [ ] `T10.3-11` - Cross-backend and Phase 1 regression checks; extend `rls-progression.integration.test.ts`.
- [ ] `T10.3-12` - Update docs: mark context Use Cases rows (`GetPlateausUseCase`, `ResolvePlateauUseCase`, `GetDeloadRecommendationUseCase`, `StartDeloadUseCase`, `SnoozeDeloadUseCase`, `EndDeloadUseCase`) `implemented`, fix any doc/code drift found, add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/progression/plateau.test.ts` | unit (pure, table-driven) | window, minimum exposures, deload excluded, equal best, rep-only metric, suppression 2 / 3, `alternateRange` (01, 05) |
| `tests/progression/deload.test.ts` | unit (pure, table-driven) | `recommendDeload` cases (last deload 2026-08-10 vs today 2026-10-01 = 7 weeks → recommended with 3, none with 2; 2026-08-01 = 8 weeks), `applyDeload` rounding (06, 07) |
| `tests/progression/progression-engine.test.ts` (extended) | unit | worked examples 6 (`original`) and 13 (05, 07) |
| `tests/progression/get-plateaus.use-case.test.ts` | use-case (real SQLite) | marker, suppression, program exercise ids, progression off (02, 11) |
| `tests/progression/resolve-plateau.use-case.test.ts` | use-case | the three options persist, stale UI error, unknown option (03, 04) |
| `tests/progression/deload-use-cases.test.ts` | use-case | start / snooze / end, idempotence, `is_deload` on a new workout, local dates (08, 09) |
| `tests/progression/progression-insights.service.test.ts` | use-case | port methods on SQLite (12) |
| `tests/progression/deload-card.test.ts` | component / render | texts, form actions, hidden when progression is off (10, 11) |
| `tests/supabase/rls-progression.integration.test.ts` (extended) | integration-RLS (gated) | non-owner cannot write overrides, backend parity (13) |
| `tests/progression/phase-1-regression.test.ts` | integration | Phase 1 fixture still renders (13) |

## Out of Scope

- Readiness check-in, `applyReadiness`, recovery map and soft warnings → story 10.4.
- Deload days in the month calendar → story 11.2.
- Plateaus and deload facts inside the AI summary text → story 11.4.
- Offline caching of the plateau sheet and suggestions → story 12.3.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
