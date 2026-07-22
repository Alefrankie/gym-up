# View Progress Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - Progress Page Load

User opens `/progress`. Page fetches all user's completed workouts with entries. Computes unique exercise list from entries.

### Step 2 - Exercise Selector

Page renders dropdown with all exercises user has logged. User selects an exercise.

### Step 3 - Chart Data Generation

Page filters entries for selected exercise. Aggregates by date: max weight per day, total volume (sum of sets × reps × weight). Applies date range filter (7d/30d/all).

### Step 4 - Chart Rendering

`ProgressChart` React island renders line chart (weight over time) and bar chart (volume over time). Weight displayed in user's preferred unit.

### Step 5 - Calendar Display

Page computes last 4 weeks of dates. Marks days with completed workouts. Renders calendar grid with dots.

### Step 6 - Streak Calculation

Page counts consecutive days with completed workouts ending today. Displays streak count and total workouts.
