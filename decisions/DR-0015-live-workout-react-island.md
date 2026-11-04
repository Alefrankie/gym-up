---
id: DR-0015
title: "Live Workout as a Single React Island with Client Session State"
status: implemented
tier: 2
date: 2026-10-01
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: cross-team
reversibility: costly
risk_flags: []

depends_on: []
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/app/src/routes/workout/"
    - "apps/app/src/lib/offline/workout-session.ts"
  issues: []
  prs: []

validation:
  criteria:
    - "The live workout screen holds the session state on the client and persists every mutation through the outbox"
  review_by: null
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-015
---
# DR-0015 · Live Workout as a Single React Island with Client Session State

## Legacy status

Accepted. **Amended 2026-10-29 by [ADR-027](./DR-0027-mobile-architecture-nestjs-sveltekit-tauri.md).** The decision stands (one live-workout screen, state in a client store, every mutation as a command) but the implementation is not a React island: the app is a SvelteKit SPA, the screen is `apps/app/src/routes/workout/[id]/+page.svelte`, and its state is a Svelte 5 `$state` snapshot persisted to IndexedDB with an outbox ([ADR-025](./DR-0025-offline-live-workout.md)). Mentions below of Astro, `exercise-card.astro`, React islands, `client:load` and the PRG form contract describe the earlier stack. The reducer-style command set and the single-screen model are what carry over.

## Context

Phase 1 renders the workout page (`/workout/[id]`) as SSR Astro markup: one `exercise-card.astro` per routine exercise, a form contract (`entries[N][...]`) read by `src/lib/client/auto-save.ts`, and a `rest-timer.tsx` React island.

Phase 2 turns the workout page into a Hevy-style live session ([PRD FR-WT-018..FR-WT-040](../docs/prd/features/workout-tracking.md)):

- add, remove, reorder, replace exercises mid-session;
- supersets, set types, RPE, per-exercise rest timers;
- a "Previous" column and load suggestions per set;
- an elapsed-time clock and running totals (volume, sets);
- offline logging ([ADR-025](./DR-0025-offline-live-workout.md)).

That is a lot of interdependent client state. Server-rendered forms plus vanilla scripts cannot keep it coherent.

The docs (`system.md`, context readmes) also mention Svelte islands, but **Svelte is not installed**. Every interactive component in the codebase is React (`rest-timer.tsx`, `progress-chart.tsx`) through `@astrojs/react`.

## Decision

1. The live workout screen is **one React island**, `src/components/live-workout/live-workout.tsx`, mounted by `src/pages/workout/[id].astro` with `client:load`.
2. Session state lives in a single reducer (`live-workout.reducer.ts`) whose state shape mirrors the persisted model of [ADR-016](./DR-0016-workout-data-model-v2.md): `workout → workout_exercises[] → sets[]`.
3. Every user action dispatches a reducer action **and** enqueues a persistence command (`upsert-set`, `add-exercise`, `reorder`, …) in an outbox. A sync worker sends the outbox to the API. Phase 2 Round 9 sends online only; Round 12 adds IndexedDB durability ([ADR-025](./DR-0025-offline-live-workout.md)).
4. The island receives its initial state from SSR as a JSON prop: workout, exercises, sets, previous values, suggestions, and user settings. It never imports repositories. It talks to the server only through `src/pages/api/**` endpoints, which call use cases from the composition roots ([ADR-010](./DR-0010-per-context-composition.md)).
5. **React is the only island framework.** Svelte references in the docs are historical. New components use `.tsx` (interactive) or `.astro` (static).

## Rationale

- One reducer makes add, reorder, superset, and timers deterministic and unit-testable without a DOM.
- The outbox pattern is the same mechanism offline needs later, so Round 12 changes durability, not architecture.
- React is already a dependency and already used. Adding Svelte would add a second runtime for no gain.

## Trade-offs

- **Pro:** Testable pure reducer; a single source of truth on the client.
- **Pro:** Hevy-grade interactions (drag reorder, inline timers) become straightforward.
- **Con:** A larger JS payload on `/workout/[id]` (~40-60 KB gz with React). Acceptable: it is the app's core screen.
- **Con:** The Phase 1 form contract (`entries[N][...]`) and `auto-save.ts` are retired. Their tests are replaced by reducer and API tests.

## Consequences

- `exercise-card.astro` and `src/lib/client/auto-save.ts` are deleted in [story-9.1](../docs/stories/phase-2/round-9/story-9.1.md). They are replaced by `live-workout/*.tsx` components.
- `rest-timer.tsx` is refactored into a hook (`use-rest-timer.ts`) used per exercise ([story-9.2](../docs/stories/phase-2/round-9/story-9.2.md)).
- `system.md` "Interactive Components" is corrected to React-only.
- Reducer tests live in `tests/workout-tracking/live-workout.reducer.test.ts` (no DOM, no mocks, per [ADR-009](./DR-0009-object-mothers.md)).

## Referenced by

- [workout-tracking PRD](../docs/prd/features/workout-tracking.md)
- [workout-tracking context](../docs/architecture/contexts/workout-tracking/readme.md)
- [ADR-025](./DR-0025-offline-live-workout.md)

## Log

- 2026-10-01 accepted as ADR-015 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/015-live-workout-react-island.md; status mapped to the code as of today: implemented. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet.
- 2026-11-04 note: Implementation detail superseded by DR-0027: the React island is now a Svelte screen in the SvelteKit SPA. The single client-state + outbox decision stands.
