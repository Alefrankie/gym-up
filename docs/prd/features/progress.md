# Feature — Progress & Charts

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- Components: [architecture/components.md](../../architecture/components.md)
- Decisions: [ADR-002](../../architecture/decisions/002-chartjs-react-island.md), [ADR-006](../../architecture/decisions/006-kg-storage.md)
- Phase 2 decisions: [ADR-020](../../architecture/decisions/020-personal-records.md), [ADR-026](../../architecture/decisions/026-weekly-ai-coach-summary.md)
- Phase 2 stories: [Round 10](../../stories/phase-2/round-10/readme.md) (records), [Round 11](../../stories/phase-2/round-11/readme.md) (stats, AI summary), [Round 12](../../stories/phase-2/round-12/readme.md) (export)

Progress visualization: workout history, exercise-specific charts, streaks, calendar.

**Phase 2** adds Hevy's personal records, exercise detail statistics, weekly charts, muscle distribution, month calendar, weekly streaks, CSV export and a weekly AI coach summary.

---

## Functional Requirements

### History

#### FR-PR-001

Chronological list of all user workouts. Each entry: date, routine day, exercises completed, total volume. Paginated (20/page). Tap to expand for full set detail.

### Charts

#### FR-PR-002

User selects exercise from dropdown. Line chart shows weight over time. Bar chart shows volume (sets × reps × weight) over time.

#### FR-PR-003

Date range filter: 7d, 30d, all time.

#### FR-PR-004

Charts rendered as React island via Chart.js. Per [ADR-002](../../architecture/decisions/002-chartjs-react-island.md).

#### FR-PR-005

Weight displayed in user's preferred unit. Per [ADR-006](../../architecture/decisions/006-kg-storage.md).

### Calendar & Streaks

#### FR-PR-006

Calendar grid showing last 4 weeks. Dots on workout days.

#### FR-PR-007

Current consecutive workout days count. Total workouts completed.

---

## Phase 2 — Functional Requirements

### Personal Records

#### FR-PR-008

Record types, the e1RM formula, eligible sets and the "is it a PR" rule are exactly as in [ADR-020](../../architecture/decisions/020-personal-records.md).

#### FR-PR-009

**Live PR badge**: when a checked set beats the baseline ([ADR-020 §4](../../architecture/decisions/020-personal-records.md)), the row shows 🏆 with the record label (e.g. "Mejor 1RM"). A short toast and a haptic pulse fire once per set. Unchecking or editing the set below the record removes the badge.

#### FR-PR-010

The workout summary ([FR-WT-036](./workout-tracking.md#fr-wt-036)), the workout detail and the feed card ([FR-SO-002](./social.md#fr-so-002)) list or count the workout's PRs, recomputed server-side.

#### FR-PR-011

Exercise **Récords** tab ([FR-EL-003](./exercise-library.md#fr-el-003)): each applicable record type with its value, the date and a link to the workout, plus the **rep-max table** (1–12 reps → best weight + date) for `weight_reps` exercises.

### Exercise Statistics

#### FR-PR-012

Exercise **Gráficas** tab: line charts for the metrics that apply to the exercise type, one point per workout. Ranges: 30 d / 3 m / 1 a / todo.

| Type | Charts |
|---|---|
| `weight_reps`, `weighted_bodyweight` | Peso máximo, Mejor 1RM, Mejor serie (volumen), Volumen de sesión, Reps totales |
| `bodyweight_reps`, `assisted_bodyweight` | Reps máximas, Reps totales |
| `duration` | Duración máxima, Duración total |
| `distance_duration` | Distancia, Duración, Ritmo |
| `weight_distance` | Peso máximo, Distancia |

The Phase 1 `/progress` exercise selector (FR-PR-002/003) remains and links to the exercise detail.

#### FR-PR-013

Exercise **Historial** tab: every session with this exercise, newest first: date, workout name, and the sets with type labels and PR badges. 20 per page.

### Overview Statistics

#### FR-PR-014

`/progress` **Resumen** section: bar charts for the last 12 ISO weeks of workouts/week, duration/week, volume/week (bodyweight volume per [FR-BM-007](./body-metrics.md#fr-bm-007)) and sets/week. Tapping a bar shows the week's workouts.

#### FR-PR-015

**Distribución muscular**: sets per muscle (primary = 1, secondary = 0.5, working sets only) for 7 d / 30 d / 3 m, as a horizontal bar chart sorted descending, with the Δ vs the previous equal period. Muscles above 20 sets/week (normalized) are flagged ([ADR-022 §3](../../architecture/decisions/022-readiness-and-recovery.md)).

#### FR-PR-016

**Calendar v2** (extends FR-PR-006): month view with ‹ › navigation. Workout days are marked, and deload days use a distinct color. Tapping a day lists that day's workouts.

#### FR-PR-017

**Weekly streak** (Hevy): consecutive ISO weeks, ending with the current or previous week, in which the user completed ≥ `days_per_week` workouts (default 3 when unset). Shown next to the Phase 1 day streak (FR-PR-007).

#### FR-PR-018

**History v2** (extends FR-PR-001): each item shows the workout name, date, duration, volume, sets and PR count. Filter by program/routine. Tapping opens the workout detail ([FR-SO-003](./social.md#fr-so-003)) with *Editar*/*Repetir*/*Eliminar* for own workouts.

### AI Coach

#### FR-PR-019

The **Resumen semanal** card on `/progress` shows the cached AI summary for the last closed ISO week ([ADR-026](../../architecture/decisions/026-weekly-ai-coach-summary.md)) and a *Ver semana actual* action. It is generated lazily on first view.

#### FR-PR-020

*Generar resumen* for the current week is limited to 3 per week, then the button disables with "Disponible el lunes". When AI is unavailable, the template fallback text appears with no error.

### Export

#### FR-PR-021

Ajustes → *Exportar datos* downloads `gymup-workouts.csv`, one row per set, ordered by start time, `exercise position`, `set_number`, with Hevy-compatible columns:

`title, start_time, end_time, description, exercise_title, superset_id, exercise_notes, set_index, set_type, weight_kg, reps, distance_km, duration_seconds, rpe`

Times are ISO-8601 in the user's timezone. Only the user's own workouts are exported. Body measurements export separately ([FR-BM-008](./body-metrics.md#fr-bm-008)).

---

## Phase 2 — Non-Functional Requirements

#### NFR-PR-P2-01

The exercise records, charts and history tabs respond with p95 < 300 ms for a user with 5,000 sets. Above that, add a cache ([ADR-020 Trade-offs](../../architecture/decisions/020-personal-records.md)).

---

## Data

| Table | Access |
|-------|--------|
| `workouts` | Read own |
| `workout_entries` | Read own |
| `exercises` | Read all |
| `workout_exercises` | Read own (Phase 2) |
| `body_measurements` | Read own, for bodyweight volume (Phase 2) |
| `ai_weekly_summaries` | Owner-only CRUD (Phase 2) |

## Components

| Component | Spec |
|-----------|------|
| `ProgressChart.tsx` | [components.md](../../architecture/components.md) |
| `PrBadge`, `RecordsTable`, `RepMaxTable` | [components.md → Progress v2](../../architecture/components.md#progress-v2) |
| `WeeklyBarsChart`, `MuscleDistributionChart`, `MonthCalendar` | [components.md → Progress v2](../../architecture/components.md#progress-v2) |
| `CoachSummaryCard` | [components.md → Progress v2](../../architecture/components.md#progress-v2) |
