---
id: ADR-025
title: Offline-First Live Workout — IndexedDB Outbox, Idempotent Sync
type: decision
status: accepted
date: 2026-10-01
amended: 2026-10-29
---

# ADR-025: Offline-First Live Workout — IndexedDB Outbox, Idempotent Sync

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted. Implements PI-007.

**Amended 2026-10-29 by [ADR-027](./027-mobile-architecture-nestjs-sveltekit-tauri.md) section 5 and the implementation of Phase 4 of the [mobile migration plan](../../planning/mobile-migration-plan.md).** The original decision assumed an Astro web app with a hand-written service worker and a PWA manifest. The app is now a static SvelteKit SPA bundled into a Tauri build, so the **service worker and the manifest are dropped** and the outbox, client ids, idempotent upserts and sync loop are kept and built. What changed is marked below; sections 3 to 6 keep their decisions.

| Piece | Original | Now |
|-------|----------|-----|
| App shell | Service worker precache | Not needed: the SPA is bundled in the Tauri app |
| Cached reads | Service worker runtime caching of GET responses | Read-through cache in IndexedDB (`cache:<path>`) |
| Outbox, client ids, idempotent upserts, sync loop | Specified | **Implemented** (core commands) |
| `updated_at` last-write-wins and tombstones | Specified | **Deferred** (section 5) |
| Playwright offline test | Specified | Not yet automated; checked manually in a browser, see Verification |

## Context

Gyms often have no signal (basements). Hevy works fully offline during a workout and syncs later. Our live workout ([ADR-015](./015-live-workout-react-island.md)) funnels every mutation through an outbox.

## Decision

### 1. Scope

Offline is guaranteed for: **an already-started live workout** (log and edit sets, timers, finish), **starting a workout from the last downloaded routine**, and **reading the last-cached screens** (today's routine, history, progress, family, nutrition and the current user). Photos, the AI analysis and settings need the network and say so. Phase 2 adds the remaining workout edits (add, remove and reorder exercises, delete a set) as outbox commands with their stories.

### 2. Shell and cached reads (amended)

- There is **no service worker and no manifest**. The Tauri build bundles the SPA, so the shell is always available; the web build is a convenience and needs the network on first load.
- GET responses are cached by `apps/app/src/lib/offline/cache.ts`: network first (10 s timeout), and when the request fails for lack of signal (`NetworkError`) the last good copy from IndexedDB is returned and flagged as stale. A 4xx or 5xx is never replaced by cached data.
- After a successful sync the workout caches are invalidated so the next read refetches.

### 3. Client-generated IDs

Every entity created on the client (workouts, sets, meals, photos; `workout_exercises` with Phase 2) gets its UUID from `crypto.randomUUID()` on the client. Create endpoints are **idempotent upserts by id**, so replaying a command is always safe. Implemented: `POST /workouts` (also resumes the workout already stored for that id), `PUT /workouts/:id/sets` (a set is also unique by `exerciseId` + `setNumber`), `POST /nutrition/entries` and `PUT /photos/:id`.

### 4. Outbox (implemented)

- IndexedDB database `gymup`, stores `outbox` (`{ seq, command, createdAt, attempts, nextAttemptAt }`), `failed` (rejected commands with the server's message and status) and `kv` (cache entries, workout snapshots and the `active-workout` pointer).
- Implemented commands: `start-workout`, `upsert-set`, `finish-workout`. Planned with their stories: `add-exercise`, `update-exercise`, `remove-exercise`, `reorder-exercises`, `delete-set`, `discard-workout`.
- The sync loop (`sync.svelte.ts`) drains in `seq` order, **one command at a time**, on app start, on the `online` event, on return to the foreground, after every enqueue, and every 15 s while something is pending. Only one drain runs at a time.
- Outcomes per command: success removes it; **network errors, 5xx, 408 and 429** keep it and delay the next try with exponential backoff (1 s, 2 s, 4 s ... capped at 5 minutes), without skipping ahead of older commands; **401** pauses draining without counting an attempt, so the queue survives a re-login; **any other 4xx** moves it to `failed` and draining continues. The UI shows the pending count, an offline state and the failed commands with **Retry** and **Discard** (`SyncBanner.svelte`).
- **Coalescing:** a new `upsert-set` for a set that already has a pending command replaces it in place, keeping its position before a later `finish-workout`.
- **Id remapping:** the API keeps one workout per user per day. If the server answers `start-workout` with a different workout id, the engine rewrites the workout id of the queued commands, moves the local snapshot and sends the user to the server's workout.
- **Local-first snapshot:** the open workout (exercises, set rows with their ids, unit, status) is written to `session:<id>` on every action, so a reload or a killed app restores it without the network. Merging server data never overwrites a set that still has a pending command.
- **Sign-out** warns about unsent changes and then clears the outbox, the cache and the snapshots, so another account never receives this user's commands.

### 5. Conflict rule (deferred)

The only realistic conflict is the same workout edited on two devices. The decided rule stands: **last-write-wins per row by `updated_at`** set by the client, the server ignoring an older upsert, and deletes tombstoned for 30 days (`deleted_at`) so a stale upsert cannot resurrect a row. **It is not implemented yet.** Today a workout is edited from one device at a time, replays are safe by the natural key, and a conflicting start is resolved by the id remapping above. Implement it with the first story that edits an existing workout from a second device or adds `delete-set`, because deletes are what need tombstones.

### 6. Starting offline

`start-workout` offline uses the last downloaded `GET /workouts/today` payload (routine exercises and target sets), stored in the cache at the last online dashboard load. The workout exists on the device immediately and the command reaches the server when there is signal. Previous values and suggestions come from the same payload, so they may be one session stale and are labelled "Sugerencia sin conexión" when Phase 2 adds them.

## Rationale

- An outbox with idempotent upserts is the simplest offline-sync model that cannot duplicate data.
- Dropping the service worker removes the stale-shell failure mode and a second caching layer; the cache is plain data in IndexedDB that the app controls.
- Coalescing, backoff and the failed store keep a flaky gym connection from turning into lost or duplicated sets.

## Trade-offs

- **Pro:** Works in basements; no data loss on reload or when the app is killed.
- **Pro:** No service-worker upgrade problems.
- **Con:** The web build is not installable as a PWA and does not load without the network the first time. Accepted: the product is the Android app.
- **Con:** Until section 5 is implemented, two devices editing the same workout offline are not reconciled.

## Consequences

- Endpoints return `200` or `201` for replays and never an error for duplicates; ownership violations return `403` or `404`.
- Tests: 12 unit tests of the outbox with `fake-indexeddb` (order, backoff, 5xx, 4xx, 401, coalescing, remap, no concurrent drains, retry and discard); API end-to-end tests for idempotent start and set upserts.
- Phase 2 stories that add commands extend `Command` in `apps/app/src/lib/offline/outbox.ts` and the sender, and add the matching idempotent endpoint.

## Verification

Checked in a real browser against the deployed API (2026-10-29): with the network simulated as down, a workout was started, two sets were logged and the workout was finished; the outbox held `start-workout`, `upsert-set`, `upsert-set`, `finish-workout`; on reconnect it drained in order with 0 failures and the server ended with the workout completed and exactly those two sets. An automated Playwright version of this check is still to be written (the original plan for story 12.3).

## Referenced by

- [workout-tracking PRD](../../prd/features/workout-tracking.md) (NFR-WT-P2-01..03)
- [system.md](../system.md) (Offline)
- [mobile migration plan](../../planning/mobile-migration-plan.md) (Phase 4)
