# Product Overview

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

## Vision

Gym workout tracking for families starting gym together. Phase 1: two predefined routines, quick logging, progress visualization, and sibling motivation through public stats. Phase 2: the logging power of Hevy plus the coaching of Gravl, still family-first.

## Problem

Starting gym is easy. Tracking consistently is hard. No app fits "I have a fixed routine, I want to log what I did, and I want to see how my siblings are doing" without bloat.

## Scope — In

- Two predefined routines: male (push/pull/legs) and female (glute-focused + upper body)
- Per-user workout logging: exercise, sets, reps, weight
- Progress tracking: history, charts, streaks
- Multi-user with isolated data, public stats visibility
- Simple auth: email/password
- kg/lbs toggle
- Rest timer between sets
- Optional notes per exercise
- Private progress photos
- Cardio reminder (display only, not tracked)

## Scope — Out (Phase 1)

- Custom routine builder → **Phase 2**
- Exercise library with instructions → **Phase 2**
- Nutrition tracking → delivered in Phase 1 Round 5
- Wearable integrations → out
- Social features beyond family group → Phase 2 adds feed/likes/comments *inside* the family; groups stay out
- Native mobile app → out (Phase 2 ships an installable PWA)

## Phase 2 — Hevy + Gravl Parity

**Goal:** by the end of Phase 2, a user can drop Hevy or Gravl and use gym-up daily without missing anything that matters to a family of lifters.

- **From Hevy (logging & community):** free and routine-based live workouts; add/reorder/replace exercises mid-session; supersets; set types; RPE; "Previous" column; per-exercise rest timers; 100+ exercise library with instructions and custom exercises; routine builder with programs; personal records; exercise and weekly statistics; muscle distribution; body measurements; family feed with likes and comments; share image; plate and warm-up calculators; CSV export; offline logging; installable app.
- **From Gravl (coaching):** onboarding questionnaire with program recommendation; "next workout" rotation; load suggestions by double progression; plateau detection; deload weeks; readiness check-in; muscle recovery; weekly coach summary.
- **Unique to gym-up (kept):** private progress photos with comparison, AI nutrition from photos, family-first visibility.

Plan and stories: [stories/phase-2/readme.md](../stories/phase-2/readme.md). Parity checklist: [stories/phase-2/readme.md → Exit Criteria](../stories/phase-2/readme.md#exit-criteria--hevy--gravl-parity).

### Phase 2 — Out of scope

- Wearables / Apple Health / Google Fit sync
- Native apps (iOS/Android); push notifications beyond the in-browser rest-timer notification
- Follow graph, public profiles, groups beyond the family (PI-024)
- ML-based coaching (the rules are deterministic, [ADR-021](../architecture/decisions/021-progression-engine.md))
- Video hosting for exercises (external links only, [ADR-017](../architecture/decisions/017-exercise-catalog.md))

## Success Criteria

- User can log a workout in under 30 seconds
- User can see weight progression for any exercise over time
- Siblings can view each other's profiles and recent workouts
- Works on mobile browser and desktop

### Phase 2 success criteria

- Starting the next workout takes ≤ 2 taps from opening the app.
- Logging a set with a suggestion takes 1 tap (check).
- A full workout can be logged with the network off and syncs without loss.
- Every exercise shows "Previous", a suggestion (after its first session) and PR badges.
- A sibling's finished workout appears in the feed on the next load, and can be liked or commented.
