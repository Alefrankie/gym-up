---
story_id: "11.1"
round: "round-11"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/body-metrics/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["body-metrics"]
  prd_requirements: ["FR-BM-001", "FR-BM-002", "FR-BM-003", "FR-BM-004", "FR-BM-005", "FR-BM-006", "FR-BM-007", "FR-BM-009"]
  architecture_decisions: ["ADR-023"]
  flows: ["log-measurement.flow.md"]
blocked_by: ["story-9.4"]
blocks: ["story-11.2", "story-11.3", "story-12.4"]
---

# Story 11.1 — Body Measurements

Parent: [../readme.md](../readme.md)

## Summary

Creates the `body-metrics` context: a Hevy-style log of body weight, body fat and 14 body measurements with charts, a "latest values" card and Δ, strictly **owner-only** ([ADR-023](../../../architecture/decisions/023-body-metrics-privacy.md)). Ships migration 008 for both backends, the `BodyWeightPort` that stories 11.2 (bodyweight volume) and 11.3 (photo comparison) consume, the three `/profile/measurements` pages and the card on the `/profile` hub. Closes Hevy parity row **H19**.

Context: [body-metrics readme](../../../architecture/contexts/body-metrics/readme.md) · Flow: [log-measurement.flow.md](../../../architecture/contexts/body-metrics/flows/log-measurement.flow.md) · Schema: [008 — Body metrics](../../../architecture/database-schema.md#008--body-metrics-adr-023) · PRD: [FR-BM-001..009](../../../prd/features/body-metrics.md).

## Files in scope

**Modify**

- `db/schema.ts` — add `bodyMeasurements` table with `uq_body_measurements_user_date` and `idx_body_measurements_user`; export `BodyMeasurement`, `NewBodyMeasurement`.
- `db/migrations/` — `0008_body_metrics.sql` plus `meta/` from `drizzle-kit generate`.
- `src/pages/profile/index.astro` (story 9.4) — `LatestMeasurementsCard` and the *Medidas* link ([FR-WT-045](../../../prd/features/workout-tracking.md#fr-wt-045); story 9.4 hides the link until this page exists, [phase rule 7](../readme.md#7-forward-compatible-ui)).

**Create**

- `supabase/migrations/008_body_metrics.sql` — table, index, RLS enabled, policies `body_measurements_select_own`, `_insert_own`, `_update_own`, `_delete_own` (idempotent).
- Domain (`src/lib/contexts/body-metrics/domain/`): `body-metrics.types.ts`, `body-metrics.constants.ts` (`BodyMetricKeys`, `BodyMetricRules`, `MeasurementRanges`, `MetricLabels`, `UnitFactors`), `body-metric-rules.ts`, `body-metric-units.ts`, `measurement-series.ts`, `body-measurement.repository.ts`, `ports/measurement-profile.port.ts`, `ports/body-weight.port.ts`, `errors.ts`.
- Application (`.../application/`): `log-measurement.use-case.ts`, `update-measurement.use-case.ts`, `delete-measurement.use-case.ts`, `list-measurements.use-case.ts`, `get-measurement-series.use-case.ts`, `get-latest-measurements.use-case.ts`, `body-weight.service.ts` (`BodyWeightService implements BodyWeightPort`).
- Infrastructure: `sqlite/sqlite-body-measurement.repository.ts`, `sqlite/sqlite-measurement-profile.adapter.ts`, `supabase/supabase-body-measurement.repository.ts`, `supabase/supabase-measurement-profile.adapter.ts`.
- `src/lib/contexts/body-metrics/body-metrics.composition.ts` (exports the use cases, `bodyWeightPort`, `bodyMetricsBackend`).
- UI: `src/components/body-metrics/measurement-form.astro`, `measurement-chart.tsx`, `latest-measurements-card.astro`, `measurement-list.astro`.
- Pages: `src/pages/profile/measurements/index.astro`, `src/pages/profile/measurements/new.astro`, `src/pages/profile/measurements/[id]/edit.astro`.
- API: `src/pages/api/body-measurements/index.ts` (POST), `src/pages/api/body-measurements/[id].ts` (POST update, DELETE), `src/pages/api/body-measurements/series.ts` (GET).
- Tests and mothers: see [Test Plan](#test-plan).

**Not in scope (must not change):** `ExportMeasurementsCsvUseCase` and `/api/export/measurements.csv` (story 12.4), `/settings` export link, the stats consumers of `BodyWeightPort` (stories 11.2, 11.3), Phase 1 tables.

## Happy Path

1. From `/profile` the user taps *Medidas* → `/profile/measurements` (empty state "Aún no has registrado medidas") → *Nueva medición*.
2. `MeasurementForm` at `/profile/measurements/new`: date (default today, `max` = today), weight, body fat, 14 lengths with unit suffix (kg·lb, %, cm·in) and a note (≤ 300 characters); all fields optional, at least one required ([FR-BM-001](../../../prd/features/body-metrics.md#fr-bm-001)).
3. `LogMeasurementUseCase` converts display values to stored kg / cm (2 decimals), merges into the entry of that date if one exists ([FR-BM-002](../../../prd/features/body-metrics.md#fr-bm-002)), validates ranges and the date, and persists. The page answers 303 to `/profile/measurements` with the toast "Medición guardada" or "Medición actualizada" when merged.
4. The list shows entries newest first, 20 per page, only fields with values, with *Editar* and *Eliminar* ("¿Eliminar esta medición?") ([FR-BM-003](../../../prd/features/body-metrics.md#fr-bm-003)); values show in the user's unit with 1 decimal ([FR-BM-004](../../../prd/features/body-metrics.md#fr-bm-004)).
5. `MeasurementChart` plots one metric over 30 d / 3 m / 1 a / todo; body weight adds a 7-entry moving average ([FR-BM-005](../../../prd/features/body-metrics.md#fr-bm-005)). `LatestMeasurementsCard` shows the latest weight and body fat with the Δ vs the closest entry ≥ 30 days earlier ("−1.8 kg en 34 días") ([FR-BM-006](../../../prd/features/body-metrics.md#fr-bm-006)).
6. Other contexts read the owner's own weight through `BodyWeightPort` (`getBodyWeightOn`, `findNearest`, `listBodyWeights`) for bodyweight volume ([FR-BM-007](../../../prd/features/body-metrics.md#fr-bm-007)) and photo comparison.
7. No other user can see any row ([FR-BM-009](../../../prd/features/body-metrics.md#fr-bm-009)): a sibling's request returns nothing; a foreign id is a 404, never 403.

## Decisions

- **FR-BM-007 split.** This story ships the port, its three methods and the pure `bodyWeightOn` / `nearestWeight`; the volume formulas (`setVolume`) are consumed in story 11.2. Here FR-BM-007 is verified at the port level (right weight, owner only).
- **Local date helper.** "Today" and `measured_on` are local dates in `profiles.timezone`. Reuse the local-date helper of Rounds 8–9 if one exists; otherwise add `localDateKey(date, timeZone)` in `src/lib/date/local-date.ts` and tell stories 11.2 and 11.4, which need the same helper.
- **Moving average** starts at the first entry with the mean of the available entries (fewer than 7) instead of leaving a gap (Hevy draws the line from the first point).
- **Δ copy** uses the real day gap ("en 34 días"), since the compared entry is the closest one at least 30 days earlier; `null` Δ when no such entry.
- **Stored precision.** Values are stored rounded to 0.01 after unit conversion; display rounds to 0.1; lbs users enter inches for lengths.
- **Race on create.** A unique violation (SQLite constraint, Postgres `23505`) on `create` re-reads the entry and merges once.
- **Validation lives in the domain** (`BodyMetricRules.Ranges`), not as length CHECKs in the DB, except weight and body fat which also have DB CHECKs (schema 008).
- **Chart.js island** reuses the Phase 1 setup ([ADR-002](../../../architecture/decisions/002-chartjs-react-island.md)); the endpoint returns display units plus a `unit` field.

## Acceptance Criteria

- AC-11.1-01: Migration 008 exists for both backends (`db/migrations/0008_body_metrics.sql`, `supabase/migrations/008_body_metrics.sql`), is idempotent on Supabase, and creates `body_measurements` with `UNIQUE (user_id, measured_on)` and `idx_body_measurements_user`.
- AC-11.1-02: A user logs weight and waist on two dates and sees the two charts plus the Δ; a sibling's request for those rows returns nothing and a sibling's GET/POST/DELETE on the entry id returns 404 (round AC-R11-01).
- AC-11.1-03: Unit conversion: with `weight_unit = lbs`, display `180` lb is stored as `81.65` kg, display `32` in waist as `81.28` cm, stored `81.65` shows `180.0` ("180 lb") for lbs and "81.7 kg" for kg users.
- AC-11.1-04: Validation: an empty entry → `EmptyMeasurementError` ("Registra al menos una medida"); values outside `BodyMetricRules.Ranges` (e.g. `bodyFatPct: 1.5`) → `MeasurementOutOfRangeError('bodyFatPct', 2, 70)`; each range boundary (min, max, min − 0.01, max + 0.01) behaves; a future date → `FutureMeasurementDateError` ("La fecha no puede ser futura"); notes of 300 characters pass and 301 → `NotesTooLongError`. The form re-renders with the Spanish message (400).
- AC-11.1-05: Merge: existing `{ weightKg: 80, waistCm: 85 }` + incoming `{ weightKg: 79.5, waistCm: null, chestCm: 100 }` → `{ weightKg: 79.5, waistCm: 85, chestCm: 100 }`; saving on an existing date returns `merged: true` and the toast "Medición actualizada".
- AC-11.1-06: Edit replaces exactly the submitted fields (an emptied field becomes null) and the date may change; moving to a date that already has an entry → `MeasurementDateTakenError` (409); a missing or foreign id → `BodyMeasurementNotFoundError` (404).
- AC-11.1-07: Delete asks "¿Eliminar esta medición?" and removes only the owner's row (204); deleting a foreign id affects 0 rows (404).
- AC-11.1-08: The list is newest first, 20 per page (`?page=`), only fields with values; `GetMeasurementSeriesUseCase` returns the metric over 30 d / 3 m / 1 a / todo with the moving average (weights 80, 81, 79, 80, 82, 81, 80, 78 → 80, 80.5, 80, 80, 80.4, 80.5, 80.43, 80.14) computed on the full history.
- AC-11.1-09: `GetLatestMeasurementsUseCase` returns latest weight and body fat with Δ vs the closest entry ≥ 30 days earlier (latest 2026-10-01 78.2 kg, entries 2026-09-05 79.0 and 2026-08-28 80.0 → compared 2026-08-28, Δ −1.8, "−1.8 kg en 34 días"); no entry ≥ 30 days earlier → Δ `null`.
- AC-11.1-10: `BodyWeightPort`: `getBodyWeightOn` (points 09-01 80, 09-10 79; date 09-09 → 80; 08-31 → `null`), `findNearest` within ±3 days (09-04 with points 09-01 and 09-06 → 09-06; 09-10 → `undefined`; tie → earlier) and `listBodyWeights` (ASC) never return another user's rows.
- AC-11.1-11: The `/profile` hub and `/profile/measurements` show `LatestMeasurementsCard`; unauthenticated requests to pages and API → redirect / 401; the user id always comes from the session.
- AC-11.1-12: RLS (Supabase): as a non-owner, `select` returns 0 rows, `insert` with the owner's `user_id` fails, `update` and `delete` affect 0 rows (`tests/supabase/rls-body-measurements.integration.test.ts`); the SQLite repository filters `user_id` on every query and user B cannot find, list, update or delete user A's rows.
- AC-11.1-13: Both backends (`STORAGE_BACKEND=sqlite|supabase`) behave identically, including the create-race retry. Phase 1 regression: applying migration 008 to `tests/fixtures/phase-1.db` leaves history, `/progress` points and streak unchanged.

## Tasks

- [ ] `T11.1-01` - `db/schema.ts` `bodyMeasurements`, `drizzle-kit generate` (`0008_body_metrics.sql`), `supabase/migrations/008_body_metrics.sql` with the four RLS policies; migration test on the Phase 1 fixture.
- [ ] `T11.1-02` - `body-metrics.constants.ts`, `body-metrics.types.ts`, `errors.ts`.
- [ ] `T11.1-03` - Pure modules `body-metric-units.ts`, `body-metric-rules.ts`, `measurement-series.ts` with table-driven tests (worked examples of the readme).
- [ ] `T11.1-04` - `BodyMeasurementRepository`, `MeasurementProfilePort`, `BodyWeightPort` abstract classes.
- [ ] `T11.1-05` - SQLite implementations (owner guard `where user_id = ?`, update / delete check affected rows, unique-violation retry) with repository tests.
- [ ] `T11.1-06` - Supabase implementations (`.eq('user_id', userId)` defence in depth, `23505` mapping) and `rls-body-measurements.integration.test.ts` as a non-owner.
- [ ] `T11.1-07` - Use cases `LogMeasurement`, `UpdateMeasurement`, `DeleteMeasurement`, `ListMeasurements`, `GetMeasurementSeries`, `GetLatestMeasurements` and `BodyWeightService`, with use-case tests on real SQLite.
- [ ] `T11.1-08` - `body-metrics.composition.ts` (`resolveStorageBackend`, `buildXxx(backend)`); export `bodyWeightPort`.
- [ ] `T11.1-09` - API: `POST /api/body-measurements`, `POST` and `DELETE /api/body-measurements/[id]`, `GET /api/body-measurements/series`.
- [ ] `T11.1-10` - `MeasurementForm`, `MeasurementList`, `LatestMeasurementsCard` and the three pages (PRG, toasts, 404 for foreign id, empty state).
- [ ] `T11.1-11` - `MeasurementChart` island (metric selector, ranges, moving average, display-unit conversion).
- [ ] `T11.1-12` - `/profile` hub: `LatestMeasurementsCard` and *Medidas* link.
- [ ] `T11.1-13` - Cross-backend and Phase 1 regression checks.
- [ ] `T11.1-14` - Update docs: mark context Use Cases rows (`LogMeasurementUseCase`, `UpdateMeasurementUseCase`, `DeleteMeasurementUseCase`, `ListMeasurementsUseCase`, `GetMeasurementSeriesUseCase`, `GetLatestMeasurementsUseCase`, `BodyWeightService`) `implemented`, fix any doc/code drift found, add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/body-metrics/body-metric-units.test.ts` | unit (pure) | kg↔lb, cm↔in, stored rounding 0.01, display rounding 0.1 (03) |
| `tests/body-metrics/body-metric-rules.test.ts` | unit (pure, table-driven) | every range boundary, empty, future date, notes 300 / 301, `mergeMeasurement` (04, 05) |
| `tests/body-metrics/measurement-series.test.ts` | unit (pure) | moving average example, range cutoffs, `latestWithDelta`, `bodyWeightOn`, `nearestWeight` ±3 and tie (08–10) |
| `tests/body-metrics/log-measurement.use-case.test.ts` | use-case (real SQLite) | create, same-date merge, lbs input stored in kg, validation errors (03–05) |
| `tests/body-metrics/update-delete-measurement.use-case.test.ts` | use-case | replace semantics, date collision, foreign id not found (06, 07) |
| `tests/body-metrics/list-and-latest.use-case.test.ts` | use-case | paging 20, series, latest with Δ (08, 09) |
| `tests/body-metrics/sqlite-body-measurement.repository.test.ts` | repo | **owner guard**: user B cannot find, list, update or delete user A's rows; unique `(user_id, measured_on)`; create race (02, 12, 13) |
| `tests/body-metrics/body-weight.service.test.ts` | use-case | the three port methods never return another user's rows (10) |
| `tests/body-metrics/body-metrics-migration.test.ts` | integration | table and indexes exist; Phase 1 fixture unchanged (01, 13) |
| `tests/supabase/rls-body-measurements.integration.test.ts` | integration-RLS (gated) | **required by ADR-023**: non-owner select 0 rows, insert fails, update / delete 0 rows (12) |

Mothers (`tests/body-metrics/mothers/`): `BodyMeasurementMother` (`.weightOnly(kg, date)`, `.full(date)`, `.withWaist(cm, date)`); `tests/body-metrics/test-db.ts` re-exports the workout-tracking harness.

## Out of Scope

- Bodyweight volume in weekly stats (`setVolume` with `BodyWeightPort`) → story 11.2.
- Body weight under photos in the comparison view → story 11.3.
- Measurements CSV export and the `/settings` link → story 12.4.
- Body metrics in the feed, share image or member card: never (ADR-023).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
