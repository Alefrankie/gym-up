---
id: DR-0032
title: "A user can freeze one missed training day per week to keep the streak"
status: proposed
tier: 1
date: 2026-11-07
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: null

scope: local
reversibility: costly
risk_flags: [data]

depends_on: [DR-0031]
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/api/db/migrations/0028_streak_freezes.sql"
    - "apps/api/src/lib/contexts/progress/"
    - "apps/api/src/nest/progress/progress.controller.ts"
    - "apps/app/src/routes/progress/+page.svelte"
  issues: []
  prs: []

validation:
  criteria:
    - "After missing yesterday's planned training day, the user can freeze it and the streak is not broken"
    - "A frozen day does not add to the streak count or to total workouts"
    - "Only one freeze is accepted per ISO week (Monday to Sunday, UTC) of the frozen day"
    - "A freeze is refused when yesterday already has a workout, is a planned rest day, or there is no streak to save"
  review_by: null
  evidence: []
  validated_on: null

tags: [progress, streak, gamification, migration]
---

# DR-0032 · A user can freeze one missed training day per week to keep the streak

## Context

The streak counts consecutive planned training days with a completed workout; planned rest days are
neutral. Missing one planned day resets the streak, even when the user trains the next day. The user
asked for a way to keep the streak after one missed day.

## Decision

**Proposed:** Store freezes as rows keyed by `(user_id, day)` in a new `streak_freezes` table, with
`day` as a UTC `YYYY-MM-DD` key, the same day key the streak already uses. The streak treats a
frozen day like a planned rest day: it neither counts nor breaks the chain.

`POST /progress/streak/freeze` freezes **yesterday** only. It is accepted when yesterday was a planned
training day with no completed workout, the streak before yesterday is at least 1, and no freeze
exists in the same ISO week (Monday to Sunday) as yesterday. Otherwise it answers 409. `GET
/progress/streak` also returns `canFreeze` and `frozenDays` so the app can show the button and the
frozen days.

## Alternatives considered

- **Back-date a workout.** Rejected: it corrupts history, totals and the shared family view.
- **Freeze any past day.** Rejected: it would let a user repair old streaks; yesterday covers the need.
- **Earned or stockpiled freezes.** Deferred: more rules and UI for a single-user need.

## Consequences

- One new table and migration; dropping the feature later needs a migration back.
- Streak and public-view stats that call `getStreak` honor freezes.
- Days are UTC like the rest of the streak code, so near midnight "yesterday" follows UTC.

## Log

- 2026-11-07 proposed following the user's request for a 1-per-week streak freeze.
