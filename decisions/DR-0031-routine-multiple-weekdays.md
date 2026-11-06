---
id: DR-0031
title: "A routine can be scheduled on multiple weekdays"
status: proposed
tier: 2
date: 2026-11-06
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: null

scope: cross-team
reversibility: costly
risk_flags: [data]

depends_on: [DR-0018, DR-0019, DR-0025, DR-0027]
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/api/db/migrations/0027_routine_day_weekdays.sql"
    - "apps/app/src/lib/weekday-routine.ts"
    - "apps/api/src/lib/contexts/routines/"
    - "apps/app/src/routes/programs/[id]/[routine]/+page.svelte"
    - "apps/app/src/routes/dashboard/+page.svelte"
  issues: []
  prs: []

validation:
  criteria:
    - "A user can assign one routine to more than one weekday without duplicating its exercises or routine record"
    - "Existing single-weekday assignments are preserved by migration"
    - "When several routines are scheduled on the same weekday, the dashboard offers each eligible routine to start"
    - "After one scheduled routine is completed, other routines scheduled for that weekday remain available"
    - "Programs with no scheduled weekdays continue to use rotation"
    - "Previously cached program data with a single weekday remains readable offline"
  review_by: null
  evidence: []
  validated_on: null

tags: [routines, scheduling, migration]
---

# DR-0031 · A routine can be scheduled on multiple weekdays

## Context

The routine editor stores at most one planned weekday on each `routine_days` row. The dashboard's
weekday planner therefore cannot express common schedules such as using the same upper-body routine
on Monday, Wednesday and Friday. The editor and date-selection helper also treat one scheduled
routine per weekday as implicit, while the workout model already allows distinct routines to be
started on the same date.

## Decision

**Proposed:** A routine may be assigned to any subset of the seven weekdays. A routine with no
assigned weekdays remains in the existing rotation-based schedule. Several routines may be assigned
to the same weekday. On such a day, the dashboard lists all of them; starting one does not hide the
others, and after completing one the remaining scheduled routines stay available.

Persist weekday assignments as rows keyed by `(routine_day_id, weekday)` in a child table. Migrate
each existing non-null `routine_days.weekday` value to one assignment row. Keep the old column
available during the compatibility period and accept old single-weekday payloads and cached DTOs;
new clients read and write the weekday list.

The dashboard resolves every routine scheduled for the local calendar weekday. It fetches each
routine's existing workout state for today so an in-progress workout resumes, a completed one is
marked done, and the user can start a different scheduled routine. No automatic priority is applied
between routines.

## Alternatives considered

- **Duplicate the routine for each weekday.** Rejected: edits and exercise plans would drift across
  copies, undermining the user's request for the same routine.
- **Store a JSON array in the existing integer column.** Rejected: it changes the column's meaning
  and type without a clear relational constraint or clean migration path.
- **Allow multiple routines but choose one automatically.** Rejected: it can silently prioritize a
  routine when the user intentionally scheduled several; the user chose an explicit picker.
- **Forbid overlaps.** Rejected: the user chose to allow selecting among overlapping routines.

## Consequences

- Contracts, API mapping, repository writes and the routine editor handle lists of weekday values.
- The dashboard's schedule lookup returns all matches and presents them, preserving remaining choices
  after one is completed.
- Existing single-day assignments and offline cached data continue to work through migration and
  compatibility reads.
- This is a T2 proposal because it changes persisted schedule data and spans API, app and offline
  boundaries. Its status remains proposed pending human acceptance; implementation does not imply
  acceptance.

## Log

- 2026-11-06 proposed following the user-approved behavior and implementation request.
