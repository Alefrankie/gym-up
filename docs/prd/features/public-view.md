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

## Phase 2 — Functional Requirements

Feed, likes and comments live in [social.md](./social.md) ([ADR-024](../../architecture/decisions/024-social-interactions.md)). Public view keeps the member list and member profiles.

#### FR-PV-007

The member profile (`/family/[user_id]`) adds a **Entrenamientos** list (20 per page, newest first). It uses the feed card ([FR-SO-002](./social.md#fr-so-002)) and links to the workout detail ([FR-SO-003](./social.md#fr-so-003)).

#### FR-PV-008

The member card (FR-PV-005) adds the weekly streak ([FR-PR-017](./progress.md#fr-pr-017)) and the PRs in the last 30 days.

#### FR-PV-009

The FR-PV-004 exclusions are extended. Body metrics, readiness check-ins, progression overrides, AI summaries and nutrition are never visible to other users ([ADR-023](../../architecture/decisions/023-body-metrics-privacy.md), [ADR-022](../../architecture/decisions/022-readiness-and-recovery.md), [ADR-026](../../architecture/decisions/026-weekly-ai-coach-summary.md)).

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
