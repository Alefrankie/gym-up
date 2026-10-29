# Log Measurement Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-BM-001 … FR-BM-006](../../../../prd/features/body-metrics.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [11.1](../../../../stories/phase-2/round-11/story-11.1.md) |
| Decisions | [ADR-023](../../../decisions/023-body-metrics-privacy.md), [ADR-006](../../../decisions/006-kg-storage.md) |

## Happy Path

### Step 1 - Open the Form

From `/profile` → *Medidas* → *Nueva medición*, the user opens `/profile/measurements/new`. `MeasurementForm` shows the date (default today in `profiles.timezone`, `max` = today) and every field with the unit of `weight_unit` (kg + cm, or lb + in).

### Step 2 - Fill In Values

The user types "Peso corporal 80.4" and "Cintura 84". All other fields stay empty. Notes are optional (≤ 300 characters).

### Step 3 - Submit

*Guardar* posts the form to `POST /api/body-measurements`. The endpoint resolves the session user and calls `LogMeasurementUseCase` with display-unit values.

### Step 4 - Convert and Validate

The use case converts each non-empty value to stored units (`toStored`, 2 decimals), then `validateMeasurement`: at least one value, every value within `BodyMetricRules.Ranges`, date not in the future, notes ≤ 300.

### Step 5 - Create or Merge

`findByDate(userId, measuredOn)` finds no entry → `create`. The page redirects (303) to `/profile/measurements` with the toast "Medición guardada".

### Step 6 - See the Result

`/profile/measurements` shows `LatestMeasurementsCard` ("80.4 kg · −1.8 kg en 34 días"), `MeasurementChart` (body weight with its 7-entry moving average) and the list, newest first.

---

## Edge Case: Same Date Twice (Merge)

An entry exists for today with `{ weightKg: 80.4, waistCm: 84 }`. The user logs `{ weightKg: 80.1, chestCm: 101 }`. `mergeMeasurement` → `{ weightKg: 80.1, waistCm: 84, chestCm: 101 }`; the existing row is updated (no second row) and the toast reads "Medición actualizada" (FR-BM-002).

## Edge Case: lbs User

`weight_unit = 'lbs'`: the user types 180 lb and waist 32 in → stored `81.65` kg and `81.28` cm. Every page displays lb / in with 1 decimal.

## Edge Case: Edit an Entry

`/profile/measurements/[id]/edit` → `POST /api/body-measurements/[id]` → `UpdateMeasurementUseCase`. The submitted form is the full new state: an emptied field becomes null. Changing the date onto a date that already has an entry → 409 "Ya hay una medición en esa fecha".

## Edge Case: Delete

*Eliminar* → confirm "¿Eliminar esta medición?" → `DELETE /api/body-measurements/[id]` → 204 → list reloads. Charts and the latest card recompute; bodyweight volume in stats changes on the next read (derived, nothing to invalidate).

## Edge Case: Used Elsewhere

Progress stats call `bodyWeightPort.listBodyWeights` / `getBodyWeightOn` for bodyweight-exercise volume (FR-BM-007). Photo comparison calls `bodyWeightPort.findNearest(userId, photoDate, 3)` (FR-PP-009). Both pass the session user's id only.

## Failure: Nothing Entered

All fields empty → `EmptyMeasurementError` → 400; the form re-renders with "Registra al menos una medida".

## Failure: Out of Range

`bodyFatPct = 75` → `MeasurementOutOfRangeError` → 400 with "Grasa corporal debe estar entre 2 y 70 %". For lbs users the message shows the range in display units.

## Failure: Future Date

`measuredOn` after today (user timezone) → `FutureMeasurementDateError` → 400 "La fecha no puede ser futura".

## Failure: Foreign Entry

Editing or deleting an id that belongs to another user → the owner-guarded query matches 0 rows → `BodyMeasurementNotFoundError` → 404. In Supabase, RLS also hides the row (`body_measurements_*_own`).
