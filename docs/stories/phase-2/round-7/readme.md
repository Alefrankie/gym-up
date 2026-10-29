# Round 7 — Exercise Library & Data Model v2

Parent: [../readme.md](../readme.md) · Phase: 2

## Purpose

Lay the foundation every later round needs:

- a workout model that supports free workouts, set types, RPE and every exercise type ([ADR-016](../../../architecture/decisions/016-workout-data-model-v2.md));
- a Hevy-size exercise catalog with custom exercises ([ADR-017](../../../architecture/decisions/017-exercise-catalog.md)).

## Why this round exists

The live workout (Round 9), routines (Round 8), PRs and progression (Round 10) all read `workout_exercises`, `set_type`, `exercise_type` and `equipment`. Shipping the schema and the catalog first keeps later rounds UI-only on top of a stable model. Phase 1 behaviour must be untouched after this round: same pages, same numbers.

## Strategy

1. **Migrate first, no UI change** (7.1). The backfill makes every Phase 1 workout readable through the new shape. Phase 1 pages keep working because `workout_entries.exercise_id` stays.
2. **Seed** (7.2): 107 exercises from one data file, used by both backends.
3. **Read UI** (7.3): library pages plus the reusable picker, which Round 8 and Round 9 consume.
4. **Write UI** (7.4): custom exercises.

## Stories

| ID | Title | Size | Status |
|----|-------|------|--------|
| [story-7.1.md](./story-7.1.md) | Workout data model v2 migration | L | ready |
| [story-7.2.md](./story-7.2.md) | Exercise library seed (107 exercises) | M | ready |
| [story-7.3.md](./story-7.3.md) | Exercise library browse, detail & picker | M | ready |
| [story-7.4.md](./story-7.4.md) | Custom exercises | S | ready |

## Acceptance Criteria (round-level)

- AC-R7-01: Migrations 004/0005 and 005 apply cleanly on an empty DB **and** on the Phase 1 fixture DB, on both backends.
- AC-R7-02: After migration, `/history`, `/progress` and `/family` show the same numbers for the Phase 1 fixture as before (regression test).
- AC-R7-03: `/exercises` lists ≥ 100 exercises, with search and filters per FR-EL-001..004.
- AC-R7-04: The exercise picker component is usable from a test page and returns ordered IDs (consumed in Rounds 8–9).
- AC-R7-05: A user can create, edit, archive and restore a custom exercise; a sibling cannot add it to their workouts (FR-EL-009).
