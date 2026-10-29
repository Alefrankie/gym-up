# Readiness Check-In Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-PG-009 … FR-PG-012](../../../../prd/features/progression.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [10.4](../../../../stories/phase-2/round-10/story-10.4.md) |
| Decisions | [ADR-022](../../../decisions/022-readiness-and-recovery.md), [ADR-021](../../../decisions/021-progression-engine.md) |

## Happy Path

### Step 1 - Start the Workout

The user taps *Empezar* on the dashboard. The workout is created (workout-tracking) and `/workout/[id]` loads with `ExerciseSuggestion[]` (no readiness score yet) and the routine's fatigued muscles from `GetSoftWarningsUseCase({ routineDayId })`.

### Step 2 - Readiness Step Appears

Because `readiness_enabled` is true, the workout has no check-in and no set is completed, the island shows `ReadinessStep` before the exercise list:

| Question | 1 | 5 |
|---|---|---|
| ¿Cómo dormiste? | Muy mal | Muy bien |
| ¿Energía hoy? | Agotado | A tope |
| ¿Agujetas / dolor? | Mucho dolor | Nada |

If a `fatigued_muscle` warning exists, it lists the muscles ("Cuádriceps aún se está recuperando") and offers "Elegir otra rutina".

### Step 3 - User Answers

The user moves the three sliders and taps *Continuar*. The island computes `readinessScore` and `applyReadiness` locally (pure modules) and updates the suggestions instantly.

### Step 4 - Persist the Check-In

The island calls `POST /api/progression/readiness` `{ workoutId, sleep, energy, soreness }`. `SubmitReadinessUseCase` validates, scores (`round(avg, 1)`), upserts `readiness_checkins` for the workout, copies the score to `workouts.readiness_score` and returns `{ score, band, suggestions }`. The island replaces its suggestions with the server result.

### Step 5 - Adjusted Session

| Band | Score | Header | Suggestions |
|---|---|---|---|
| `good` | ≥ 3.5 | — | unchanged |
| `moderate` | 2.5 – 3.4 | "Sesión ajustada: −1 serie" | −1 working set per exercise (min 1) |
| `low` | < 2.5 | "Hoy sesión ligera" | −1 working set (min 1) and weight × 0.9 (rounded), reason `readiness_low` |

### Step 6 - Revert (Optional)

*Usar plan original* swaps every exercise back to `original` (client-only). The stored score is kept.

---

## Edge Case: Skip

*Saltar* closes the step. Nothing is stored; `readiness_score` stays null and suggestions are unchanged.

## Edge Case: Readiness Disabled

`readiness_enabled = false` → the step never shows (FR-PG-013).

## Edge Case: Choose Another Routine

"Elegir otra rutina" discards the empty in-progress workout (*Descartar entrenamiento*, [FR-WT-038](../../../../prd/features/workout-tracking.md#fr-wt-038); no confirmation because no set exists) and returns to `/dashboard` with the routine picker open.

## Edge Case: Reload After Check-In

SSR reads `workouts.readiness_score` and passes it in `SuggestionContext`; suggestions arrive already adjusted and the step does not show again.

## Edge Case: Deload and Low Readiness

Both apply: deload first, then readiness. The reason stays `deload`; `readinessAdjusted = true` (worked example 6 in the [context readme](../readme.md#worked-examples-test-cases)).

## Edge Case: Offline

The adjustment is applied locally from the bundled pure modules. Decision: the check-in is not part of the ADR-025 outbox command list; if the POST fails, the island retries once on the next `online` event and otherwise drops it (the session is still adjusted on this device). Simplest option; neither Hevy nor Gravl documents it.

## Failure: Invalid Answers

An answer outside 1–5 or non-integer → `InvalidReadinessAnswerError` → 400. The island prevents this with sliders; the server check is defence in depth.

## Failure: Foreign Workout

`workoutId` of another user → 403. No row is written.

---

## Related: Recovery Widget and Soft Warnings

On `/dashboard`, `GetMuscleRecoveryUseCase` renders `RecoveryWidget` (heat map ≥ 400 px, list below) and `GetSoftWarningsUseCase` renders banners: "Días seguidos" on the 4th consecutive training day, "Volumen alto" when a muscle has > 20 hard sets in 7 days. Banners are dismissible for the day (localStorage) and never block.
