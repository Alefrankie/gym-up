# Round 11 — Body, Stats & Insights

Parent: [../readme.md](../readme.md) · Phase: 2

## Purpose

Give the user a Hevy-level view of their progress: body measurements ([ADR-023](../../../architecture/decisions/023-body-metrics-privacy.md)), exercise and weekly statistics, muscle distribution, a month calendar and weekly streaks; progress photo comparison (PI-005); and a Gravl-like weekly coach summary ([ADR-026](../../../architecture/decisions/026-weekly-ai-coach-summary.md)).

## Why this round exists

Users stay with an app when they can see progress. Hevy's stats tab and body measurements are among its most used features. The weekly summary turns the numbers into a coach voice.

## Strategy

1. **Body metrics first** (11.1): a new context, owner-only. It provides `BodyWeightPort` for bodyweight volume (11.2) and the photo comparison (11.3).
2. **Statistics** (11.2): every aggregate is a read model over existing tables, with no new tables. It reuses `personal-records.ts` from 10.1.
3. **Photo compare** (11.3): UI on top of Phase 1 photos plus `BodyWeightPort`.
4. **AI summary** (11.4): deterministic facts, then Gemini phrasing, with a template fallback and a weekly cache.

## Stories

| ID | Title | Size | Status |
|----|-------|------|--------|
| [story-11.1.md](./story-11.1.md) | Body measurements | M | ready |
| [story-11.2.md](./story-11.2.md) | Statistics v2: exercise detail, weekly charts, muscle distribution, month calendar, weekly streak | L | ready |
| [story-11.3.md](./story-11.3.md) | Progress photo comparison | S | ready |
| [story-11.4.md](./story-11.4.md) | Weekly AI coach summary | M | ready |

## Acceptance Criteria (round-level)

- AC-R11-01: A user logs weight and waist on two dates and sees charts plus the Δ; a sibling's request for those rows returns nothing (RLS integration test).
- AC-R11-02: The exercise detail shows Gráficas / Historial / Récords for any logged exercise, with metrics matching its type.
- AC-R11-03: Weekly bars, muscle distribution and the month calendar match a hand-computed fixture.
- AC-R11-04: Two photos can be compared side by side and with the slider, with body weight shown when available.
- AC-R11-05: The weekly summary shows for the last closed week. Without `GEMINI_API_KEY` the template text appears, with no error.
