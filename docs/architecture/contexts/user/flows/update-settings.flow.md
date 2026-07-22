# Update Settings Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - Settings Page Load

User opens `/settings`. Page fetches current profile via `ProfileRepository.getById()`. Populates form fields.

### Step 2 - User Edits Fields

User changes display_name, routine_type, weight_unit, and/or calorie_goal.

### Step 3 - Client-Side Validation

Client validates:
- display_name: non-empty, max 50 chars
- routine_type: 'hombre' or 'mujer'
- weight_unit: 'kg' or 'lbs'
- calorie_goal: null or 1-10000

If invalid: show inline error. Stop.

### Step 4 - Save

Client calls `ProfileRepository.update()` with changed fields only. Supabase updates `profiles` row.

### Step 5 - Confirmation

Show "Saved" confirmation. Page refreshes with updated values.

---

## Failure: Validation Error

Step 3 fails. Show inline error per field. Do not submit.

## Edge Case: Routine Type Change

Changing routine_type shows warning: "This won't affect your past workouts. Only future workouts will use the new routine."
