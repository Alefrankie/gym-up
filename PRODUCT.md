# Product Intent · Gym Up

> One page. The only product-intent document in this repo; others link here.
> Last reviewed: 2026-11-04 (migration to DDE; content taken from `apps/app/PRODUCT.md`, the most recent intent, written 2026-10-29 after the move to the mobile stack, and checked against the code).

## Problem
Starting at the gym is easy; tracking consistently is hard. No app fits "I follow a routine, I want to log what I did quickly, even with no signal, and see how my training partners are doing" without bloat.

## Users
A small circle of people who train together (a few people, not a public audience). They use the phone in the gym between sets: one hand, sweaty, glancing at the screen, often with bad signal. They follow a rotating routine, log sets, and see what the other members trained in the Community feed.

## Outcome
Track gym workouts quickly and offline: see today's routine, log each set, and see what you lifted last time so you know what to beat. Build your own programs from an exercise library, follow progress over time, and keep a friendly accountability loop through the Community feed (DR-0028).

Signals:
- Logging a full workout takes a few taps per set (legacy target: a set in under 30 seconds; with a suggestion, 1 tap).
- Starting the next workout takes 2 taps or fewer from opening the app.
- A full workout can be logged with the network off and syncs without loss.

## Constraints
- Android first: SvelteKit static SPA inside Tauri 2; the same build is served as a web app ([DR-0027](decisions/DR-0027-mobile-architecture-nestjs-sveltekit-tauri.md)).
- Everything needed in the gym works with no signal ([DR-0025](decisions/DR-0025-offline-live-workout.md)).
- Weights stored as kg, shown in kg or lbs ([DR-0006](decisions/DR-0006-kg-storage.md)). Reps are a single target number.
- Cloud features (photo storage, AI analysis) are optional and may answer 503.
- Progress photos and body metrics are owner-only ([DR-0005](decisions/DR-0005-private-photos.md), [DR-0023](decisions/DR-0023-body-metrics-privacy.md)).
- Spanish UI copy: plain and short. Large touch targets (44px or more), strong contrast, reduced motion respected.

## Non-goals
- A public social network, follow graph or public profiles.
- Wearables / Apple Health / Google Fit sync.
- Remote push notifications in the first release (only local notifications, e.g. rest timer).
- ML-based coaching (coaching rules are deterministic, [DR-0021](decisions/DR-0021-progression-engine.md)).
- Video hosting for exercises.

## Open decision (owner)
Two intent documents existed and they disagree. This file follows the more recent one; the owner must settle these points and then record the outcome (a Log line or a new DR):

1. **Audience: "family" or "friends".** `docs/prd/overview.md` (and DR-0004, DR-0017, DR-0024) speak of a family of siblings; `apps/app/PRODUCT.md` speaks of a small circle of friends in invite-code groups (the `groups` context exists in the code).
2. **Social feed.** `docs/prd/overview.md` Phase 2 adds a feed with likes and comments ([DR-0024](decisions/DR-0024-social-interactions.md), accepted, not built). `apps/app/PRODUCT.md` says "a private group (invite code) instead of a public social feed" and "a handful of friends, never a feed". **Settled 2026-11-05 by [DR-0028](decisions/DR-0028-global-feed-and-member-profiles.md):** groups retired; every signed-in member sees the others' completed workouts, with likes and no comments.
3. **Phase 2 scope: Hevy + Gravl parity.** The overview commits to parity (progression, readiness, PRs, weekly AI summary: DR-0016, DR-0019..DR-0026, mostly not built). The newer intent does not mention parity. Confirm whether parity is still the goal.
