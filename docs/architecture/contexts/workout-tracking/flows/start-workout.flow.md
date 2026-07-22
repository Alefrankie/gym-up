# Start Workout Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - Dashboard Load

User opens `/dashboard`. Page fetches current user session and profile (`routine_type`, `weight_unit`). Gets current weekday via `new Date().getDay()` (1=Mon, 5=Fri).

### Step 2 - Routine Lookup

Page queries `routine_days` for user's `routine_type` matching today's `day_number`. Fetches associated `routine_exercises` with `exercises` join. Displays exercise list with target sets/reps.

### Step 3 - Existing Workout Check

Page checks if `workouts` record exists for today (`user_id + workout_date`). If exists and `in_progress` → show "Continue". If `completed` → show summary. If none → show "Start".

### Step 4 - User Starts Workout

User taps "Start workout". Client inserts `workouts` record: `user_id`, `routine_day_id`, `workout_date = today`, `status = 'in_progress'`. Returns `workout_id`.

### Step 5 - Redirect to Workout Page

Client redirects to `/workout/[workout_id]`. Page loads with exercise list and empty entry fields.

---

## Failure: Weekend

Step 2 fails if `day_number` is 6 or 7 (Sat/Sun). Page shows "Rest day" with dropdown to manually select a day (1-5). User selects → flow continues from Step 3 with selected day.

## Failure: No Routine Assigned

Step 2 fails if `profiles.routine_type` is null. Redirect to `/settings` to select routine.
