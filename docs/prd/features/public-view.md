# Feature — Public View (Family)

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- Decisions: [ADR-004](../../architecture/decisions/004-rls-visibility.md), [ADR-005](../../architecture/decisions/005-private-photos.md)

Family visibility: view siblings' profiles, stats, and progress. Read-only. Stats are public within family; photos are private.

---

## Functional Requirements

### Visibility Model

#### FR-PV-001

All users can see all other users' profiles and workout stats (total workouts, streaks, last workout). Per [ADR-004](../../architecture/decisions/004-rls-visibility.md).

#### FR-PV-002

Users can only **edit** their own data. RLS enforces at DB level.

#### FR-PV-003

Display name and routine type are public within family. Email is private.

#### FR-PV-004

Photos are NOT visible in public view. Private to owner only. Per [ADR-005](../../architecture/decisions/005-private-photos.md).

### Member Card

#### FR-PV-005

Family member card shows: display name, routine type, total completed workouts, current streak, last workout date.

### Member Profile

#### FR-PV-006

Tap member → view their progress (same layout as `/progress`, read-only). No edit capabilities. No photos visible.

---

## Data

| Table | Access |
|-------|--------|
| `profiles` | Read all (`FOR SELECT USING (true)`) |
| `workouts` | Read all |
| `workout_entries` | Read all |
| `progress_photos` | **No access** — owner only |

## RLS

Per [ADR-004](../../architecture/decisions/004-rls-visibility.md):
- `profiles`: `FOR SELECT USING (true)`
- `workouts`: `FOR SELECT USING (true)`
- `workout_entries`: `FOR SELECT USING (true)`
- `progress_photos`: `FOR SELECT USING (auth.uid() = user_id)` — **owner only**

## Components

| Component | Spec |
|-----------|------|
| `FamilyMemberCard` | [components.md](../../architecture/components.md) |
