# View Family Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - Family Page Load

User opens `/family`. Page fetches all `profiles` (display_name, routine_type).

### Step 2 - Stats Calculation

For each profile, page computes: total completed workouts, current streak, last workout date.

### Step 3 - Member Card Rendering

Page renders `FamilyMemberCard` for each profile with computed stats.

### Step 4 - View Member Profile

User taps a member card. Redirects to `/family/[user_id]`.

### Step 5 - Member Progress Display

Page loads member's workouts and entries. Renders same layout as `/progress` but read-only. No photos visible. No edit capabilities.

---

## Privacy Rules

- `progress_photos` — **no access** for other users.
- Email — not displayed.
- All workout data — visible (RLS `FOR SELECT USING (true)`).
