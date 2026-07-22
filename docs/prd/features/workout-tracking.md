# Feature — Workout Tracking

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- System: [architecture/system.md](../../architecture/system.md)
- Database: [architecture/database-schema.md](../../architecture/database-schema.md)
- Components: [architecture/components.md](../../architecture/components.md)
- Decisions: [ADR-001](../../architecture/decisions/001-supabase-client-side.md), [ADR-003](../../architecture/decisions/003-routines-seed-data.md), [ADR-006](../../architecture/decisions/006-kg-storage.md)

Core workout loop: register → pick routine → daily workout → log exercises → complete → history.

---

## Functional Requirements

### Auth & Onboarding

#### FR-WT-001

User can register with email, password, display name, routine type (hombre/mujer), weight unit (kg/lbs).

#### FR-WT-002

User can login with email/password. Supabase Auth handles credential management.

#### FR-WT-003

Profile auto-created on registration via DB trigger. Per [database-schema.md](../../architecture/database-schema.md) `handle_new_user()`.

#### FR-WT-004

If already logged in, redirect to dashboard.

### Daily Workout

#### FR-WT-005

Dashboard shows today's workout based on weekday (1=Mon, 5=Fri). Maps to `routine_days.day_number` for user's routine.

#### FR-WT-006

User can start a workout, creating a `workouts` record (`status: 'in_progress'`).

#### FR-WT-007

Each exercise shows target sets/reps from `routine_exercises`. Routines stored as seed data per [ADR-003](../../architecture/decisions/003-routines-seed-data.md).

#### FR-WT-008

User logs actual sets, reps, weight per exercise. One `workout_entries` row per set.

#### FR-WT-009

Weight input shows unit label (kg or lbs) per user preference. Stored in kg internally per [ADR-006](../../architecture/decisions/006-kg-storage.md).

#### FR-WT-010

Optional free-text notes per exercise set. `notes` column on `workout_entries`.

#### FR-WT-011

Rest timer starts on set completion. 90s default, +30s extend, skip. Client-side only, no DB persistence. Per [components.md](../../architecture/components.md) `RestTimer`.

#### FR-WT-012

User can complete workout → summary shown (exercises, sets, volume, duration). Status updated to `completed`.

#### FR-WT-013

Partial workouts saved as `in_progress`, resumable later.

#### FR-WT-014

Weekend shows "Rest day" with option to manually pick a day.

#### FR-WT-015

Cardio reminder displayed: "Warmup: 5-10 min walk", "Cooldown: 15-30 min walk". Not tracked.

### Settings

#### FR-WT-016

User can update display name, switch routine type, toggle weight unit (kg/lbs). Routine type change doesn't affect past workouts.

#### FR-WT-017

User can logout.

---

## Data

| Table | Access |
|-------|--------|
| `profiles` | Read/write own |
| `routines` | Read all (seed data) |
| `routine_days` | Read all (seed data) |
| `routine_exercises` | Read all (seed data) |
| `exercises` | Read all (seed data) |
| `workouts` | CRUD own |
| `workout_entries` | CRUD own (via workout ownership) |

Full SQL: [database-schema.md](../../architecture/database-schema.md)

## Components

| Component | Spec |
|-----------|------|
| `ExerciseCard` | [components.md](../../architecture/components.md) |
| `WorkoutSummary` | [components.md](../../architecture/components.md) |
| `RestTimer` | [components.md](../../architecture/components.md) |
| `AuthForm` | [components.md](../../architecture/components.md) |
| `Navigation` | [components.md](../../architecture/components.md) |
