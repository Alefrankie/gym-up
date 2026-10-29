---
story_id: "12.4"
round: "round-12"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/progress/readme.md"
size: "S"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["progress", "body-metrics"]
  prd_requirements: ["FR-PR-021", "FR-BM-008"]
  architecture_decisions: []
  flows: []
blocked_by: ["story-11.1"]
blocks: ["story-12.5"]
---

# Story 12.4 — CSV export (workouts + measurements)

Parent: [../readme.md](../readme.md)

## Summary

Adds the two exports of the phase: `ExportWorkoutsCsvUseCase` (`gymup-workouts.csv`, one row per completed set, Hevy-compatible columns, [FR-PR-021](../../../prd/features/progress.md#fr-pr-021)) and `ExportMeasurementsCsvUseCase` (`gymup-measurements.csv`, [FR-BM-008](../../../prd/features/body-metrics.md#fr-bm-008)). Both are session-user only, built in the domain from existing read ports and delivered by streaming endpoints; Settings gets an **Exportar datos** section with the two download links. No table or migration. Closes Hevy row **H24** and round criterion AC-R12-05.

## Files in scope

**Modify**

- `src/pages/settings.astro` — *Exportar datos* section (`id="exportar-datos"`) with two links, per the [user context → Settings page v2](../../../architecture/contexts/user/readme.md).
- `src/pages/profile.astro` (hub, story 9.4) — the *Exportar datos* link must point to `/settings#exportar-datos`; fix it if 9.4 points elsewhere.
- `src/lib/contexts/progress/progress.composition.ts` — export `exportWorkoutsCsvUseCase`.
- `src/lib/contexts/progress/domain/progress.constants.ts` — add `CsvExportRules`.
- `src/lib/contexts/body-metrics/body-metrics.composition.ts` — export `exportMeasurementsCsvUseCase`.
- `docs/architecture/contexts/progress/readme.md`, `docs/architecture/contexts/body-metrics/readme.md`, `docs/architecture/contexts/user/readme.md` — final task.

**Create**

- `src/lib/csv/to-csv.ts` — pure RFC 4180 writer (`csvRow`, `toCsv`); `src/lib/csv/csv-response.ts` — wraps an `AsyncIterable<string>` in a streaming `Response`.
- `src/lib/contexts/progress/domain/workout-csv.ts` — `WorkoutCsvColumns`, `toWorkoutCsvRows`.
- `src/lib/contexts/progress/application/export-workouts-csv.use-case.ts`.
- `src/lib/contexts/body-metrics/domain/measurement-csv.ts` — `MeasurementCsvColumns`, `toMeasurementCsvRows`.
- `src/lib/contexts/body-metrics/application/export-measurements-csv.use-case.ts`.
- `src/pages/api/export/workouts.csv.ts`, `src/pages/api/export/measurements.csv.ts`.
- `tests/csv/to-csv.test.ts`, `tests/csv/csv-parse.ts` (reference RFC 4180 parser used only by tests), `tests/progress/workout-csv.test.ts`, `tests/progress/export-workouts-csv.use-case.test.ts`, `tests/progress/export-workouts-route.test.ts`, `tests/body-metrics/export-measurements-csv.use-case.test.ts`, `tests/body-metrics/export-measurements-route.test.ts`.

**Not in scope (must not change)**: `db/**`, `supabase/**`; `StatsQueryRepository` and `BodyMeasurementRepository` contracts (the export uses their existing methods); the Phase 1 workout and progress endpoints.

## Happy Path

1. Ana opens **Perfil → Exportar datos** (or Ajustes): the *Exportar datos* section shows *Exportar entrenamientos (CSV)* and *Exportar medidas (CSV)*.
2. She taps the first link: `GET /api/export/workouts.csv`. The endpoint resolves the session user and streams the file: the header row first, then the rows of 50 workouts at a time (FR-PR-021).
3. The browser saves `gymup-workouts.csv`. Opening it in a spreadsheet shows the Hevy columns, one row per completed set, times in her timezone.
4. She taps the second link: `GET /api/export/measurements.csv` streams `gymup-measurements.csv` with `date` plus every measurement in stored units (FR-BM-008).

## Decisions

| # | Decision |
|---|---|
| D1 | `ExportWorkoutsCsvUseCase.execute({ userId })` and `ExportMeasurementsCsvUseCase.execute({ userId })` return `AsyncGenerator<string>` (CSV chunks) instead of one string, so the endpoint can stream. The context docs show a string; the final task updates them. |
| D2 | No BOM, CRLF line endings, UTF-8 (Hevy's file has none and importers read it cleanly). |
| D3 | `distance_km = distance_m / 1000` rounded to at most 3 decimals with trailing zeros trimmed (`5234 → 5.234`, `5000 → 5`). |
| D4 | The progress mapping leaves `weight_kg` empty for `bodyweight_reps` and `distance_duration`. For `duration` (weight optional, ADR-016) a stored weight of 0 exports empty and any other value exports as is. |
| D5 | The generic writer is `src/lib/csv/to-csv.ts`, used by both contexts, because body-metrics must not import progress domain files. (The progress readme lists `toCsv` inside `workout-csv.ts`.) |
| D6 | Batching: `CsvExportRules.WorkoutBatchSize = 50` workouts per `findSetsForWorkouts` call. Workouts come from one `findCompletedWorkouts(userId, null, null)` call (ASC by start). |
| D7 | The endpoints are `GET` only and read no query parameter: the user id comes from the session. Files are named without a date, as in the PRD. |
| D8 | Dependency note: the use case needs `StatsQueryRepository`, `StatsProfilePort` (story 10.1) and `ExerciseCatalogPort` (story 7.3), although the phase table lists only 11.1 as blocker. Round 12 starts after Round 10, so the order holds in practice. |

## Acceptance Criteria

- AC-12.4-01 (FR-PR-021): `GET /api/export/workouts.csv` answers 401 without a session; with one it returns 200, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="gymup-workouts.csv"`, `Cache-Control: no-store`. The first chunk is the header row, yielded before any set is read.
- AC-12.4-02 (FR-PR-021): the header is exactly `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe` (`WorkoutCsvColumns`); lines end in CRLF; fields containing a comma, a double quote or a line break are quoted and quotes are doubled; a user with no workouts gets the header row only.
- AC-12.4-03 (FR-PR-021): the file has one row per **completed**, live (`deleted_at IS NULL`) set of the user's **completed** workouts, ordered by `workouts.started_at`, `workout_exercises.position`, `workout_entries.set_number`. Unchecked sets, `in_progress` workouts and every other user's data are never exported, and a `?userId=` or any other parameter changes nothing.
- AC-12.4-04 (FR-PR-021): `start_time` and `end_time` are ISO-8601 with the offset of `profiles.timezone` (`Europe/Madrid`, 2026-09-28T16:05:00Z → `2026-09-28T18:05:00+02:00`; `America/Caracas` → `-04:00`; an `UTC` user → `+00:00`).
- AC-12.4-05 (FR-PR-021): column mapping follows the table below: `set_index` is `set_number − 1`; `drop` exports as `dropset` (`normal`, `warmup`, `failure` unchanged); `weight_kg` is always kilograms even for a `lbs` user, negative for assistance, empty per D4; `distance_km` per D3; `superset_id` is the stored integer or empty; `exercise_title` is the English catalog name; null values are empty cells.
- AC-12.4-06 (AC-R12-05): parsing the generated file with the reference RFC 4180 parser (`tests/csv/csv-parse.ts`) returns exactly the exported rows, including notes with commas, quotes and line breaks, so a spreadsheet import with the Hevy headers works.
- AC-12.4-07 (FR-BM-008): `GET /api/export/measurements.csv` (401 without a session, filename `gymup-measurements.csv`, same headers and streaming) returns `date,weight_kg,body_fat_pct,neck_cm,shoulders_cm,chest_cm,left_bicep_cm,right_bicep_cm,left_forearm_cm,right_forearm_cm,abdomen_cm,waist_cm,hips_cm,left_thigh_cm,right_thigh_cm,left_calf_cm,right_calf_cm,notes` (`BodyMetricKeys` order), one row per entry ordered by `measured_on` ascending, `date = YYYY-MM-DD`, values in stored units (kg, cm, %), empty cell for null, notes quoted when needed, only the session user's rows.
- AC-12.4-08: `/settings` renders the *Exportar datos* section with *Exportar entrenamientos (CSV)* → `/api/export/workouts.csv` and *Exportar medidas (CSV)* → `/api/export/measurements.csv` as plain download links; the `/profile` hub link *Exportar datos* lands on that section.
- AC-12.4-09 (scale, both backends): exporting 5,000 sets over 250 workouts yields chunks per batch of 50 workouts and runs `1 + ⌈250 / 50⌉` set/workout queries plus one catalog lookup (no per-workout query), identical output through the SQLite and Supabase repositories. Phase 1 workouts (fixture `tests/fixtures/phase-1.db`) export one `normal` row per completed set with empty `superset_id`.

## Tasks

- [ ] `T12.4-01` - `src/lib/csv/to-csv.ts` (`csvRow`, `toCsv`) and `tests/csv/csv-parse.ts` reference parser; `to-csv.test.ts` (quoting, doubled quotes, CRLF, empty cells, line breaks, unicode).
- [ ] `T12.4-02` - `workout-csv.ts`: `WorkoutCsvColumns`, `toWorkoutCsvRows` (offset formatting with `Intl.DateTimeFormat`, set-type map, D3, D4); table-driven `workout-csv.test.ts`.
- [ ] `T12.4-03` - `ExportWorkoutsCsvUseCase` (profile timezone → `findCompletedWorkouts` → batched `findSetsForWorkouts` → catalog lookup → chunks) + `CsvExportRules`; use-case test incl. other-user isolation, unchecked sets, query count.
- [ ] `T12.4-04` - `measurement-csv.ts` and `ExportMeasurementsCsvUseCase`; tests (header, order, empty cells, quoting, own rows only).
- [ ] `T12.4-05` - `csv-response.ts` and the two endpoints; route-handler tests (401, headers, streamed body, ignored parameters), pattern of `tests/nutrition/analyze-route-handler.test.ts`.
- [ ] `T12.4-06` - Composition exports (`exportWorkoutsCsvUseCase`, `exportMeasurementsCsvUseCase`).
- [ ] `T12.4-07` - Settings *Exportar datos* section and the `/profile` hub link.
- [ ] `T12.4-08` - Scale and Phase 1 fixture checks (5,000-set seed, `tests/fixtures/phase-1.db`).
- [ ] `T12.4-09` - Update docs: mark `ExportWorkoutsCsvUseCase` and `ExportMeasurementsCsvUseCase` `implemented`, fix doc/code drift found (D1 generator signature, D4 `duration` weight, D5 `toCsv` location), add Implementation Evidence.

## Test Plan

Worked example for `workout-csv.test.ts` (user timezone `Europe/Madrid`, `weight_unit = lbs`; workout "Pierna A", `started_at` 2026-09-28T16:05:00Z, `completed_at` 2026-09-28T17:12:30Z, notes `Buen día, sin dolor`):

| Exercise (type) | Stored set | Exported fields (after `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes`) |
|---|---|---|
| Barbell Squat (`weight_reps`) | warmup, 60 kg × 10 | `set_index 0`, `warmup`, `weight_kg 60`, `reps 10` |
| Barbell Squat | normal, 100 kg × 5, RPE 8 | `1`, `normal`, `100`, `5`, `rpe 8` |
| Barbell Squat | drop, 80 kg × 8 | `2`, `dropset`, `80`, `8` |
| Assisted Pull Up (`assisted_bodyweight`) | normal, −20 kg × 8 | `0`, `normal`, `-20`, `8` |
| Push Up (`bodyweight_reps`) | normal, 0 kg × 15 | `0`, `normal`, empty weight, `15` |
| Plank (`duration`) | normal, 0 kg, 60 s | `0`, `normal`, empty weight, `duration_seconds 60` |
| Running (`distance_duration`) | normal, 5234 m, 1500 s | `0`, `normal`, empty weight, `distance_km 5.234`, `duration_seconds 1500` |
| Farmer's Walk (`weight_distance`) | normal, 40 kg, 5000 m | `0`, `normal`, `40`, `distance_km 5` |

Every row carries `title = Pierna A`, `start_time = 2026-09-28T18:05:00+02:00`, `end_time = 2026-09-28T19:12:30+02:00`, `description = "Buen día, sin dolor"` (quoted).

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/csv/to-csv.test.ts` | unit (table) | RFC 4180 quoting, CRLF, round trip with the reference parser (02, 06) |
| `tests/progress/workout-csv.test.ts` | unit (table) | Column order, the worked example above, `set_index` 0-based, `drop → dropset`, `distance_km`, timezone offsets (Madrid, Caracas, UTC), quoting of notes with commas, quotes and newlines (02, 04, 05, 06) |
| `tests/progress/export-workouts-csv.use-case.test.ts` | use-case | Ordering, completed-only, other users excluded, unchecked sets excluded, header-only for no workouts, header first, batch and query count, Phase 1 fixture (01, 03, 09) |
| `tests/progress/export-workouts-route.test.ts` | route | 401, headers, streamed body, parameters ignored (01, 03) |
| `tests/body-metrics/export-measurements-csv.use-case.test.ts` | use-case | Header, column order, empty cells, quoting of notes, ascending order, own rows only (07) |
| `tests/body-metrics/export-measurements-route.test.ts` | route | 401, headers, filename (07) |
| Manual check now; Playwright in [12.5](./story-12.5.md) (H24) | e2e | Links present on `/settings` and reachable from `/profile`, download starts, file parses (08) |

## Out of Scope

- Import of CSV files (Hevy, Strong) → not planned in Phase 2.
- Photo, nutrition or routine export; per-date-range filters; XLSX or JSON formats.
- Scheduled or e-mailed exports.
- Browser E2E of the download → [story-12.5](./story-12.5.md) (H24).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
