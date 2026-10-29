# Round 8 — Programs & Routines

Parent: [../readme.md](../readme.md) · Phase: 2

## Purpose

Users own their training plan:

- they build programs and routines (Hevy), or adopt a recommended template (Gravl);
- they always see the next routine, with no weekday binding.

Decisions: [ADR-018](../../../architecture/decisions/018-user-owned-programs.md), [ADR-019](../../../architecture/decisions/019-rotation-scheduling-and-onboarding.md).

## Why this round exists

Phase 1 hard-codes two routines tied to weekdays. That blocks custom training, causes lost days when a session is missed, and leaves OQ-003 unsolved. The live workout (Round 9) starts from a routine, so routines must be user-owned first.

## Strategy

1. **Schema + templates + migration** (8.1). The Phase 1 routines become templates in place; every existing user gets an adopted copy and an active program. No UI change yet: the Phase 1 dashboard keeps reading routines by `routine_type`, and the templates keep that tag, until 8.3 replaces it.
2. **Builder** (8.2), with the picker from 7.3.
3. **Rotation + dashboard** (8.3) replaces `GetTodayWorkoutUseCase`.
4. **Onboarding + templates browser** (8.4).

8.2, 8.3 and 8.4 can run in parallel after 8.1.

## Stories

| ID | Title | Size | Status |
|----|-------|------|--------|
| [story-8.1.md](./story-8.1.md) | Programs schema, templates seed, user migration | L | ready |
| [story-8.2.md](./story-8.2.md) | Program & routine builder | L | ready |
| [story-8.3.md](./story-8.3.md) | Next-workout rotation & dashboard | M | ready |
| [story-8.4.md](./story-8.4.md) | Onboarding questionnaire, recommendation & templates browser | M | ready |

## Acceptance Criteria (round-level)

- AC-R8-01: Every Phase 1 user has an active program copied from their `routine_type` template; Phase 1 workouts still reference the template routines.
- AC-R8-02: A user can create a program and a routine with 3 exercises, rep ranges, rest and a superset; reorder; duplicate; archive.
- AC-R8-03: The dashboard shows "Siguiente: X" by rotation; finishing X makes the next routine appear; switching program restarts at routine 1.
- AC-R8-04: A new user completes onboarding in ≤ 5 steps and lands on an adopted, active, recommended program.
- AC-R8-05: Templates are read-only for every client (RLS test: an update on a template row fails).
