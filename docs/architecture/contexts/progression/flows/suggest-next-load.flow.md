# Suggest Next Load Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-PG-001 … FR-PG-005, FR-PG-013](../../../../prd/features/progression.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [10.2](../../../../stories/phase-2/round-10/story-10.2.md) |
| Decisions | [ADR-021](../../../decisions/021-progression-engine.md), [ADR-015](../../../decisions/015-live-workout-react-island.md), [ADR-025 §6](../../../decisions/025-offline-live-workout.md) |

## Happy Path

### Step 1 - Workout Page Loads

The user taps *Empezar* on the dashboard (or resumes a workout). `/workout/[id]` SSR loads the workout (`routineDayId`, `isDeload`, `readinessScore`) and its exercise ids through workout-tracking use cases.

### Step 2 - Request Suggestions

The page loader calls `suggestionPort.getSuggestions(userId, exerciseIds, { routineDayId, isDeload, readinessScore })` from `progression.composition.ts`. `GetSuggestionsUseCase` reads the profile (`progression_enabled`, unit, bar, plates), exercise metadata, routine targets, overrides and the completed working sets of those exercises through `ProgressionHistoryPort`.

### Step 3 - Compute Per Exercise

For each exercise: `buildExposures` → `resolveRepRange` (override → routine `target_reps_min/max` → `ProgressionDefaults.RepRange`) → `suggestNext` (decision table) or the `plateau_rebuild` override → `applyDeload` when `isDeload` → `applyReadiness` when a score exists → `detectPlateau` → `explainSuggestion`.

### Step 4 - Render Chip and Prefill

The island receives `ExerciseSuggestion[]` in its props. Each exercise shows `SuggestionChip` "Sugerido: 62.5 kg × 8". Rows are prefilled from the suggestion in a muted style (FR-WT-030 priority 1): `suggestion.sets` working rows with `weight` (shown in the user's unit) and `reps` (or `durationSeconds`).

### Step 5 - Ask Why

The user taps the chip. `SuggestionWhySheet` opens with `explanation`, e.g. "La última vez hiciste 12, 12 y 12 reps con 60 kg (tope del rango 8–12). Subimos 2.5 kg." No network call (the text is in the props).

### Step 6 - Log the Session

The user edits or confirms the prefilled values and checks sets (workout-tracking log-set flow). The finished workout becomes the next exposure; the next session repeats Step 1 with the new history.

---

## Edge Case: Exercise Added Mid-Workout

The island calls `GET /api/progression/suggestions?exerciseIds=<id>&workoutId=<id>`. The endpoint reads the workout context (owner-guarded), runs `GetSuggestionsUseCase` for that one exercise and returns its `ExerciseSuggestion`. Offline, the exercise is added without a suggestion and prefill falls back to *Anterior* (if cached) or the rep-range placeholder.

## Edge Case: First Exposure

No completed working set exists. `suggestion = null`; the chip shows `firstTimeHint` "Primera vez: elige un peso con el que llegues a 8–12 reps con 2 en reserva" (FR-PG-005). Rows are empty with the range as placeholder (FR-WT-030 priority 3).

## Edge Case: Distance Exercise

`distance_duration` / `weight_distance` → no chip at all. Prefill uses *Anterior*.

## Edge Case: Rep-Only and Duration Types

Pull-ups at 10, 9, 8 (range 8–12) → "Sugerido: 11 reps". At the top of the range → "Prueba la versión con lastre". Plank at 45 s → "Sugerido: 50 s".

## Edge Case: No Loadable Increase

The user's smallest plate makes the next loadable weight exceed the safety cap. The suggestion holds the weight at `max` reps, and the sheet says "Añade discos más pequeños en Ajustes para poder subir".

## Edge Case: Deload Workout

`isDeload = true` → chip shows the "Descarga" badge; sets `max(1, round(target × 0.6))`, weight `W × 0.9` rounded, reps = `min`. Explanation "Semana de descarga: 2 series con 70 kg × 5 para recuperar."

## Edge Case: Offline Start

The workout was started from the cached dashboard payload ([ADR-025 §6](../../../decisions/025-offline-live-workout.md)). Suggestions captured at the last online dashboard load are used and the chip shows "Sugerencia sin conexión". They are not recomputed until the next online load.

## Failure: Progression Disabled

`progression_enabled = false` → every item has `suggestion: null`, `firstTimeHint: null`, `plateaued: false`. No chips, no plateau markers; prefill uses *Anterior* (pure Hevy mode, FR-PG-013).

## Failure: Foreign Workout

`GET /api/progression/suggestions` with a `workoutId` that belongs to another user → `findWorkoutContext` returns `undefined` → 403.
