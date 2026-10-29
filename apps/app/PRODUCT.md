# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Stack
SvelteKit static SPA inside Tauri 2 (Android WebView); the same build is served as a web app. Self-hosted fonts only (offline use).

## Users
A small circle of friends who train together (a few people, not a public audience). They use the phone in the gym between sets: one hand, sweaty, glancing at the screen, often with bad signal. They follow a rotating routine, log sets, and look at each other's streaks inside a group.

## Product Purpose
Track gym workouts quickly and offline: see today's routine, log each set, and see what you lifted last time so you know what to beat. Build your own programs from an exercise library, follow progress over time, and keep a friendly accountability loop inside groups. Success is logging a full workout in a few taps per set.

## Positioning
A workout log built for the gym floor, not for the dashboard: offline-first, last-session load always beside the set you are about to do, and a private group (invite code) instead of a public social feed.

## Operating Context
Used standing or sitting in a gym, between sets, under artificial light, one thumb. Rest timer runs between sets. Data is stored in kg, shown in kg or lbs.

## Capabilities and Constraints
- Exercise library (system + custom exercises) with muscle illustrations; programs made of routines; routine rotation; workout logging with offline outbox; progress charts; nutrition log with optional AI analysis; private progress photos; groups joined by invite code.
- Reps are a single target number (no min/max).
- Weights are integers in kg in storage.
- Cloud features (photo storage, AI analysis) are optional and may answer 503.

## Brand Commitments
Name "Gym Up". Logo: dumbbell with an up arrow (to be redrawn on the new palette). Spanish UI copy. Owner direction (2026-10-29): dislikes the previous green-on-navy look; wants charcoal with fire-orange; wants depth rather than a flat interface; wants drawn icons and muscle illustrations.

## Evidence on Hand
No testimonials, metrics or external proof. Real data is dev data only.

## Product Principles
- The set you are about to do is the hero: target reps and last session's load are always visible together.
- Everything the gym needs works with no signal.
- Small and private: a group is a handful of friends, never a feed.
- Spanish, plain, short.

## Accessibility & Inclusion
Large touch targets (>= 44px), strong contrast in bright and dim gyms, reduced-motion respected.

<!-- Facts above were inferred from the repository and the owner's messages, not from a structured interview. -->
