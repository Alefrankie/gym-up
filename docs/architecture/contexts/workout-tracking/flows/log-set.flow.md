# Log Set Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - Exercise Card Display

Workout page renders `ExerciseCard` for each exercise. Each card shows exercise name, target sets/reps, and input fields for sets (reps, weight). Weight input shows unit label per `profiles.weight_unit`.

### Step 2 - User Logs Set

User fills in reps and weight for Set 1. Taps checkmark to mark complete.

### Step 3 - Auto-Save Entry

Client debounces (500ms) then inserts `workout_entries` row: `workout_id`, `exercise_id`, `set_number`, `reps`, `weight` (converted to kg if user is on lbs), `completed = true`.

### Step 4 - Rest Timer Starts

Checkmark tap triggers `RestTimer` component. Timer counts down from 90s. User can +30s or skip.

### Step 5 - Notes (Optional)

User can type optional notes in text field. Notes saved with the entry.

### Step 6 - Add Extra Set

User taps "+ Add set" to add beyond target count. New input row appears.

### Step 7 - Complete Workout

After all exercises logged, user taps "Finish workout". Client validates ≥1 entry exists. Updates `workouts.status = 'completed'`, sets `completed_at`. Redirects to summary.

---

## Failure: No Entries

Step 7 fails if no `workout_entries` exist. Shows error: "Log at least one set before finishing".

## Edge Case: Partial Save

User leaves without finishing. Workout stays `in_progress`. Next visit → resume from where they left off.
