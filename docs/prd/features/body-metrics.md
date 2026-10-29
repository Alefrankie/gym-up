# Feature — Body Metrics

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- Context: [architecture/contexts/body-metrics/readme.md](../../architecture/contexts/body-metrics/readme.md)
- Decisions: [ADR-023](../../architecture/decisions/023-body-metrics-privacy.md), [ADR-006](../../architecture/decisions/006-kg-storage.md)
- Stories: [Round 11](../../stories/phase-2/round-11/readme.md)

Phase 2. Hevy-style body weight, body fat and body measurements log, with charts. **Owner-only.**

---

## Functional Requirements

### Logging

#### FR-BM-001

`/profile/measurements/new` logs an entry for a date (default today, not in the future). Fields are all optional, but at least one is required:

| Field | Column | Range (stored unit) |
|---|---|---|
| Peso corporal | `weight_kg` | 20–400 kg |
| Grasa corporal | `body_fat_pct` | 2–70 % |
| Cuello | `neck_cm` | 10–100 cm |
| Hombros | `shoulders_cm` | 50–250 cm |
| Pecho | `chest_cm` | 50–250 cm |
| Bíceps izq / der | `left_bicep_cm` / `right_bicep_cm` | 10–80 cm |
| Antebrazo izq / der | `left_forearm_cm` / `right_forearm_cm` | 10–60 cm |
| Abdomen | `abdomen_cm` | 40–250 cm |
| Cintura | `waist_cm` | 40–250 cm |
| Cadera | `hips_cm` | 50–250 cm |
| Muslo izq / der | `left_thigh_cm` / `right_thigh_cm` | 20–120 cm |
| Gemelo izq / der | `left_calf_cm` / `right_calf_cm` | 15–80 cm |
| Nota | `notes` | ≤ 300 characters |

#### FR-BM-002

One entry per user per date. Saving on a date that already has an entry **merges** into it: non-empty fields overwrite, empty fields keep the old values.

#### FR-BM-003

`/profile/measurements` lists entries newest first, with the fields that have values. An entry can be edited or deleted (with confirmation).

#### FR-BM-004

Display units follow `weight_unit`: kg + cm, or lb + in. Input is in display units, storage is in kg/cm ([ADR-006](../../architecture/decisions/006-kg-storage.md)). Values are shown with 1 decimal.

### Charts

#### FR-BM-005

Per metric: a line chart with ranges 30 d / 3 m / 1 a / todo. Body weight also shows a 7-entry moving average line. Charts use the Chart.js island ([ADR-002](../../architecture/decisions/002-chartjs-react-island.md)).

#### FR-BM-006

The **latest values** card (profile hub + measurements page) shows the latest weight and body fat, plus the Δ vs the closest entry ≥ 30 days earlier (e.g. "−1.8 kg en 30 días").

### Integration

#### FR-BM-007

The latest body weight on or before a workout's date is used for **bodyweight-exercise volume** in stats ([FR-PR-014](./progress.md#fr-pr-014)):

- `bodyweight_reps`: bw × reps;
- `weighted_bodyweight`: (bw + w) × reps;
- `assisted_bodyweight`: max(0, bw − |w|) × reps.

Without any body weight, bodyweight volume counts as 0 and the stats show the hint "Registra tu peso para incluir ejercicios con peso corporal".

#### FR-BM-008

Export: *Exportar medidas (CSV)*, with columns `date` plus every field in stored units ([FR-PR-021](./progress.md#fr-pr-021)).

### Privacy

#### FR-BM-009

Body metrics are **never** visible to other users: not in the feed, member profiles, share images or exports of others ([ADR-023](../../architecture/decisions/023-body-metrics-privacy.md)).

---

## Data

| Table | Access |
|-------|--------|
| `body_measurements` | Owner-only CRUD (RLS `auth.uid() = user_id`) |

## Components

| Component | Spec |
|-----------|------|
| `MeasurementForm` | [components.md → Body Metrics](../../architecture/components.md#body-metrics) |
| `MeasurementChart` (React island) | [components.md → Body Metrics](../../architecture/components.md#body-metrics) |
| `LatestMeasurementsCard` | [components.md → Body Metrics](../../architecture/components.md#body-metrics) |
