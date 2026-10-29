# Round 12 — Social & Platform

Parent: [../readme.md](../readme.md) · Phase: 2

## Purpose

Close the parity gap:

- the Hevy-style family feed with likes and comments ([ADR-024](../../../architecture/decisions/024-social-interactions.md)), plus share images;
- offline, installable PWA logging ([ADR-025](../../../architecture/decisions/025-offline-live-workout.md));
- CSV export.

The round ends with the **Phase 2 parity acceptance** suite.

## Why this round exists

Siblings motivating each other was the Phase 1 premise. The feed makes it active instead of passive. Offline logging is the most common reason people stay on Hevy in basement gyms.

## Strategy

1. **Feed** (12.1) reuses `PrCountPort` (10.1) and the workout detail page.
2. **Share** (12.2) is client-side canvas only, with no server image generation.
3. **Offline** (12.3) swaps the Round 9 in-memory outbox for IndexedDB, adds the service worker and manifest, and applies migration 011 (tombstones).
4. **Export** (12.4) streams CSV.
5. **Parity E2E** (12.5) runs the exit-criteria checklist of [Phase 2](../readme.md#exit-criteria--hevy--gravl-parity) as Playwright scenarios on both backends.

## Stories

| ID | Title | Size | Status |
|----|-------|------|--------|
| [story-12.1.md](./story-12.1.md) | Family feed, workout detail, likes, comments, activity | L | ready |
| [story-12.2.md](./story-12.2.md) | Share workout as image | S | ready |
| [story-12.3.md](./story-12.3.md) | PWA + offline live workout | L | ready |
| [story-12.4.md](./story-12.4.md) | CSV export (workouts + measurements) | S | ready |
| [story-12.5.md](./story-12.5.md) | Phase 2 parity acceptance (E2E) | S | ready |

## Acceptance Criteria (round-level)

- AC-R12-01: User A finishes a workout; user B sees it in the feed, likes it and comments; A sees the activity dot and both items in `/activity`.
- AC-R12-02: The share image renders on the client and contains no body metrics or photos.
- AC-R12-03: With the network off, a user starts the next routine, logs 10 sets, finishes, reloads mid-way, and after reconnecting every set is on the server exactly once.
- AC-R12-04: The app passes Lighthouse PWA installability on Android Chrome.
- AC-R12-05: The CSV export imports into a spreadsheet with Hevy-compatible headers.
- AC-R12-06: Every row of the parity checklist passes in 12.5.
