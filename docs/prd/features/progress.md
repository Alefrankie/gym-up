# Feature — Progress & Charts

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- Components: [architecture/components.md](../../architecture/components.md)
- Decisions: [ADR-002](../../architecture/decisions/002-chartjs-react-island.md), [ADR-006](../../architecture/decisions/006-kg-storage.md)

Progress visualization: workout history, exercise-specific charts, streaks, calendar.

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

## Data

| Table | Access |
|-------|--------|
| `workouts` | Read own |
| `workout_entries` | Read own |
| `exercises` | Read all |

## Components

| Component | Spec |
|-----------|------|
| `ProgressChart.tsx` | [components.md](../../architecture/components.md) |
