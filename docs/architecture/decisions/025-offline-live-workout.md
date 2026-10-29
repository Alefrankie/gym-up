---
id: ADR-025
title: Offline-First Live Workout — PWA, IndexedDB Outbox, Idempotent Sync
type: decision
status: accepted
date: 2026-10-01
---

# ADR-025: Offline-First Live Workout — PWA, IndexedDB Outbox, Idempotent Sync

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted. Implements PI-007.

## Context

Gyms often have no signal (basements). Hevy works fully offline during a workout and syncs later. Our live workout ([ADR-015](./015-live-workout-react-island.md)) already funnels every mutation through an outbox. Phase 2 Round 9 sends that outbox online only.

## Decision

### 1. Scope

Offline is guaranteed for: **an already-started live workout** (log, edit and delete sets; add, remove and reorder exercises; timers; finish), **starting a workout from the dashboard's next routine**, and **reading the last-cached pages** (dashboard, routine list, exercise library). Feed, stats and AI summary need the network and show an "Sin conexión" state.

### 2. PWA shell

- `public/manifest.webmanifest`: name "Gym Up", `display: standalone`, icons 192/512, `start_url: /dashboard`.
- A service worker (`public/sw.js`, hand-written, no Workbox dependency) with:
  - **precache:** app shell, the live-workout JS bundle, fonts and icons (versioned cache `gymup-shell-v{build}`);
  - **runtime:** network-first for HTML pages (falling back to cache); stale-while-revalidate for `GET /api/exercises`, `GET /api/routines/*`;
  - **never caches** `POST/PUT/PATCH/DELETE` responses or auth endpoints.

### 3. Client-generated IDs

Every entity created on the client (`workouts`, `workout_exercises`, `workout_entries`) gets its UUID from `crypto.randomUUID()` on the client. All create endpoints become **idempotent upserts by id**. Replaying a command is always safe.

### 4. Outbox

- IndexedDB database `gymup`, store `outbox` holding `{ seq, command, payload, createdAt, attempts }`.
- Commands: `start-workout`, `add-exercise`, `update-exercise`, `remove-exercise`, `reorder-exercises`, `upsert-set`, `delete-set`, `finish-workout`, `discard-workout`.
- The sync worker drains in `seq` order, one at a time. It runs on the `online` event, every 15 s while online, and on `visibilitychange`. On 4xx (validation) the command is moved to `outbox_failed` and the user sees a banner. On 5xx or network failure it retries with exponential backoff (max 5 min).
- A store `sessions` holds the reducer state snapshot of the active workout, so a reload restores it without the network.

### 5. Conflict rule

The only realistic conflict is the same workout edited on two devices. **Last-write-wins per row by `updated_at`** (set by the client at mutation time). The server ignores an upsert whose `updated_at` is older than the stored row. Deletes are tombstoned for 30 days (`deleted_at`) so that a stale upsert cannot resurrect a row.

### 6. Starting offline

`start-workout` offline uses the cached `next routine` payload (routine exercises plus the previous values and suggestions captured at the last online dashboard load). Suggestions may be one session stale. That is acceptable and labelled "Sugerencia sin conexión".

## Rationale

- An outbox with idempotent upserts is the simplest offline-sync model that cannot duplicate data.
- A hand-written service worker keeps dependencies at zero and has a small surface. Astro has no first-party PWA integration that we want to depend on.

## Trade-offs

- **Pro:** Works in basements; no data loss on reload.
- **Con:** Tombstones and `updated_at` add columns to three tables.
- **Con:** Service-worker bugs can serve stale shells. Mitigated by the versioned cache plus a "Nueva versión disponible — Recargar" prompt.

## Consequences

- Columns: `updated_at` on `workouts`, `workout_exercises`, `workout_entries` (from [ADR-016](./016-workout-data-model-v2.md)), plus `deleted_at` on `workout_exercises` and `workout_entries`. Every read filters `deleted_at IS NULL`.
- Endpoints accept `{ id, updated_at, ... }` and return `403` only for ownership violations (as Phase 1 endpoints do), never an error for duplicates: a replayed upsert returns `200`.
- E2E: an offline test with Playwright `context.setOffline(true)` in [story-12.3](../../stories/phase-2/round-12/story-12.3.md).

## Referenced by

- [workout-tracking PRD](../../prd/features/workout-tracking.md) (NFR-WT-P2-01..03)
- [system.md](../system.md)
