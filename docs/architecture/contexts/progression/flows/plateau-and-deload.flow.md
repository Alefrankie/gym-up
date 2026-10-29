# Plateau and Deload Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-PG-006 … FR-PG-008](../../../../prd/features/progression.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [10.3](../../../../stories/phase-2/round-10/story-10.3.md) |
| Decisions | [ADR-021 §5–6](../../../decisions/021-progression-engine.md), [ADR-020](../../../decisions/020-personal-records.md) |

## Happy Path

### Step 1 - Plateau Detected

The user completes the 4th or later non-deload exposure of Bench Press without beating the best e1RM recorded before the last 3 exposures. On the next load, `detectPlateau` returns `plateaued: true`, `suppressed: false`.

### Step 2 - Plateau Is Shown

- Live workout: the `SuggestionChip` shows an amber "Estancado" marker.
- `/exercises/[id]`: "Estancado" marker with *Opciones*.
- `/dashboard`: "Ejercicios estancados" list (`GetPlateausUseCase`) when ≥ 1 exercise is plateaued.

### Step 3 - User Opens the Plateau Sheet

`PlateauSheet` offers three options:

| Option | Copy | Stored (`exercise_progression_overrides`) | Effect |
|---|---|---|---|
| `rebuild` (default) | **Bajar y reconstruir** | `rebuild_pending = true`, `dismissed_until_exposures = 3` | Next session: `W × 0.9`, reps `min`, reason `plateau_rebuild`; then normal double progression |
| `change_range` | **Cambiar rango** (e.g. "8–12 → 5–8 durante 4 semanas") | `rep_min`, `rep_max`, `range_until = today + 28`, `dismissed_until_exposures = 3` | Suggestions use the new range until `range_until` |
| `ignore` | **Ignorar** | `dismissed_until_exposures = 2` | Marker hidden for the next 2 exposures |

### Step 4 - Choice Is Saved

The island (or page) calls `POST /api/progression/plateaus/[exerciseId]` with `{ option }`. `ResolvePlateauUseCase` re-checks the plateau, upserts the override with `updated_at = now` and returns it. The marker disappears.

### Step 5 - Deload Becomes Due

Weeks later, `GetDeloadRecommendationUseCase` on `/dashboard` finds ≥ 6 weeks since `last_deload_at` (or since the first workout of the active program) and ≥ 3 plateaued program exercises, or ≥ 8 weeks. `DeloadCard` shows "Semana de descarga recomendada" with the reason ("Llevas 7 semanas sin descarga y 3 ejercicios estancados").

### Step 6 - User Starts the Deload

*Empezar descarga* → `POST /api/progression/deload/start` → `StartDeloadUseCase`: `deload_until = today + 7`, `last_deload_at = today`, `deload_snoozed_until = null` → 303 `/dashboard`. The dashboard shows "Descarga activa hasta {fecha}".

### Step 7 - Deload Workouts

Every workout started while `today < deload_until` gets `workouts.is_deload = true` (workout-tracking calls `SuggestionPort.isDeloadActive`). Suggestions become `applyDeload` output; the island shows the "Descarga" badge. PRs still count. These workouts are excluded from the plateau window.

### Step 8 - Deload Ends

On `deload_until` the status returns to `none` automatically. The 6/8-week clock restarts from `last_deload_at`.

---

## Edge Case: "Ahora no"

`POST /api/progression/deload/snooze` → `deload_snoozed_until = today + 7`. The card is hidden for 7 days, then reappears if the conditions still hold.

## Edge Case: End Early

Settings → *Terminar descarga* → `POST /api/progression/deload/end` → `deload_until = null`. New workouts are normal; `last_deload_at` stays.

## Edge Case: Fewer Than 4 Exposures

`exposureCount < 4` → never plateaued, regardless of results.

## Edge Case: Rep-Only Exercise

Pull-ups use best reps instead of e1RM as the plateau metric. Duration and distance types are never flagged.

## Edge Case: No Active Program Anchor

The user has never completed a workout of the active program and has no `last_deload_at` → `status: 'none'` (no anchor date).

## Failure: Stale Plateau Sheet

The user resolves a plateau that is no longer plateaued (e.g. a new PR synced from another device) → `ExerciseNotPlateauedError` → 409; the sheet closes with "Este ejercicio ya no está estancado".

## Failure: Unknown Option

`option` outside `rebuild | change_range | ignore` → `UnknownPlateauOptionError` → 400.

## Failure: Progression Disabled

`progression_enabled = false` → no markers, no plateau list, no deload card (FR-PG-013). An already active deload still marks new workouts `is_deload` until it ends.
