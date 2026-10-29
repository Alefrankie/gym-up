---
story_id: "12.3"
round: "round-12"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/workout-tracking/readme.md"
size: "L"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["NFR-WT-P2-01", "NFR-WT-P2-02", "NFR-WT-P2-03", "NFR-WT-P2-04", "NFR-WT-P2-05"]
  architecture_decisions: ["ADR-025"]
  flows: ["live-workout.flow.md", "finish-workout.flow.md"]
blocked_by: ["story-9.3"]
blocks: ["story-12.5"]
---

# Story 12.3 — PWA + offline live workout

Parent: [../readme.md](../readme.md)

## Summary

Makes the live workout durable and the app installable ([ADR-025](../../../architecture/decisions/025-offline-live-workout.md)): migration 011 (`deleted_at` tombstones), `manifest.webmanifest` and a hand-written `public/sw.js`, the IndexedDB `gymup` database behind the `OutboxStore` interface from story 9.1 (stores `outbox`, `outbox_failed`, `sessions`), a durable sync worker, offline start from the cached next routine, the "Nueva versión disponible — Recargar" prompt, `PurgeTombstonesUseCase` on login and the first Playwright offline E2E. Closes Hevy row **H23** (works offline; installable) and round criteria AC-R12-03 and AC-R12-04.

## Files in scope

**Modify**

- `db/schema.ts` — `workoutExercises.deletedAt`, `workoutEntries.deletedAt` (`integer(..., { mode: 'timestamp_ms' })`, as declared in the workout-tracking readme).
- `src/lib/contexts/workout-tracking/domain/workout-exercise.repository.ts` and `workout.repository.ts` — doc-comments only; `purgeTombstones(before)` is already declared.
- `src/lib/contexts/workout-tracking/infrastructure/{sqlite,supabase}/*-workout-exercise.repository.ts` — `remove`, `removeSet` write tombstones; `upsert`, `upsertSet` answer `stale` on a tombstoned id; reads filter `deleted_at IS NULL`; `purgeTombstones`.
- `src/lib/contexts/workout-tracking/infrastructure/{sqlite,supabase}/*-workout.repository.ts` — `findAggregate`, `finish`, previous-set queries read live rows only.
- Read-path audit (every query touching `workout_exercises` / `workout_entries`; find them with `grep -rn "workout_entries\|workoutEntries\|workout_exercises\|workoutExercises" src`): progress (`*-stats-query.repository.ts`, `*-progress.repository.ts`, `*-exercise-query.repository.ts`), social (`*-feed-query.repository.ts`), routines (`RotationQuery` adapters), progression read models, and the CSV export queries of story 12.4.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — export `purgeTombstonesUseCase`.
- `src/pages/login.astro` — after a successful login, fire `purgeTombstonesUseCase.execute()` without awaiting it (errors swallowed and logged).
- `src/layouts/app-layout.astro`, `src/layouts/layout.astro` — `<link rel="manifest">`, `apple-touch-icon`, `apple-mobile-web-app-*` metas; `app-layout.astro` also mounts the PWA islands.
- `src/components/live-workout/sync/{outbox.ts,sync-worker.ts}`, `use-live-workout.ts`, `live-workout.tsx` — swap in the IndexedDB stores (default in the browser), persisted attempts, snapshot hydrate and cleanup, banners.
- `src/components/routines/next-workout-card.tsx` — offline *Empezar* from the cached payload.
- `src/components/social/feed-list.tsx` — "Sin conexión" state when `navigator.onLine` is false (story 12.1; if 12.1 has not landed, add this check when it does).
- `astro.config.mjs` — register the `sw-stamp` integration; select `@astrojs/node` instead of Vercel when `E2E=1` (D9).
- `package.json` — devDependencies `@playwright/test`, `fake-indexeddb`, (D9) `@astrojs/node`; script `"test:e2e": "playwright test"`. Playwright is **not** present today.
- `.gitignore` — `playwright-report/`, `test-results/`.
- `docs/architecture/contexts/workout-tracking/readme.md`, `.../flows/live-workout.flow.md`, `docs/architecture/system.md` — final task.

**Create**

- `supabase/migrations/011_offline_sync.sql` (DDL as in [database-schema.md → 011](../../../architecture/database-schema.md#011--offline-sync-adr-025)); `db/migrations/00NN_offline_sync.sql` + `meta/*` from `drizzle-kit generate --name offline_sync`.
- `src/lib/contexts/workout-tracking/application/purge-tombstones.use-case.ts`.
- `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`, `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `public/apple-touch-icon.png` (180 px; `app-layout.astro` already links it but the file does not exist), `public/favicon-32x32.png` (same situation).
- `src/integrations/sw-stamp.ts` — `astro:build:done` hook that replaces `__BUILD_ID__` and `__PRECACHE_URLS__` in the built `sw.js`.
- `src/components/pwa/register-service-worker.ts`, `update-banner.tsx`, `sync-bootstrap.tsx`.
- `src/components/live-workout/sync/idb.ts`, `indexed-db-outbox.ts` (`IndexedDbOutboxStore`), `session-store.ts` (`SessionStore` + `IndexedDbSessionStore`; if story 9.1 already defined a snapshot abstraction, implement that one instead).
- `src/pages/offline/workout-shell.astro` (`prerender = true`; mounts `LiveWorkout` with `client:only="react"` and hydrates from `sessions`).
- `playwright.config.ts`, `tests/e2e/helpers/{auth,app}.ts`, `tests/e2e/offline-live-workout.e2e.spec.ts`, `tests/e2e/pwa.e2e.spec.ts`.
- `tests/workout-tracking/{indexed-db-outbox,session-store,purge-tombstones.use-case,tombstone-reads}.test.ts`, `tests/workout-tracking/outbox-store.contract.ts` (shared helper), `tests/pwa/{manifest,sw-classify,sw-stamp,register-service-worker}.test.ts`, `tests/supabase/rls-tombstones.integration.test.ts`.

**Not in scope (must not change)**: the reducer actions and the command contracts of story 9.1 / 9.2 (`live-workout.reducer.ts`, `live-workout.commands.ts`); the write endpoints' request shapes; `HealthRules`; nutrition and photos.

## Happy Path

1. The user installs the app (manifest + service worker, NFR-WT-P2-05) and opens `/dashboard` online: the page, its next-routine payload (plan, previous values, suggestions) and the app shell are cached.
2. In a basement gym the network drops. The user taps *Empezar*: `NextWorkoutCard` builds the skeleton from the cached payload, saves the session snapshot, enqueues `start-workout` and navigates to `/workout/[id]`. The service worker serves the precached `/offline/workout-shell`, which hydrates the island from `sessions[workoutId]` (NFR-WT-P2-01).
3. Every action updates the UI (< 100 ms, NFR-WT-P2-02), enqueues its command in IndexedDB and saves the snapshot (NFR-WT-P2-03). The header shows "Sin conexión · N cambios pendientes".
4. The phone reloads mid-workout: the island restores itself from the snapshot; nothing is lost.
5. The user taps *Terminar*: `finish-workout` joins the outbox; the island shows "Entrenamiento terminado · pendiente de sincronizar".
6. Signal returns (`online`, 15 s tick or `visibilitychange`): the worker drains the outbox in `seq` order. The server applies idempotent upserts, last-write-wins by `updated_at`; every set exists exactly once. The island navigates to the SSR summary.
7. A new deploy ships: the new service worker installs in the background and the banner "Nueva versión disponible — Recargar" appears; the user reloads when convenient.
8. On the next login, `PurgeTombstonesUseCase` hard-deletes tombstones older than 30 days.

## Decisions

| # | Decision |
|---|---|
| D1 | `public/sw.js` is copied verbatim by Astro, so the `sw-stamp` integration (`astro:build:done`, using the `dir` it receives; verify it is the static output of the Vercel adapter) replaces `__BUILD_ID__` (git sha or timestamp) and `__PRECACHE_URLS__`. Precache = every file under `_astro/`, icons, manifest, `/favicon.svg`, `/offline.html`, `/offline/workout-shell`. (Simplest way to guarantee the live-workout bundle is cached.) |
| D2 | The service worker registers only when `import.meta.env.PROD`. No SW in `astro dev`, to avoid stale shells while developing. |
| D3 | HTML runtime cache (network-first) is a whitelist: `/dashboard`, `/train`, `/exercises` and sub-paths ([ADR-025 §1](../../../architecture/decisions/025-offline-live-workout.md): dashboard, routine list, exercise library). `/workout/[id]` is never cached; offline it falls back to the shell. Any other offline navigation shows `/offline.html` ("Sin conexión"). |
| D4 | An upsert on a tombstoned id always answers `stale`, whatever its `updatedAt` (clients generate new UUIDs for new rows and never reuse an id; stronger and simpler than comparing against `deleted_at`). |
| D5 | When `sessions[workoutId]` exists the island hydrates from it instead of the SSR prop (the outbox may hold commands the server has not seen). The snapshot is deleted when `finish-workout` or `discard-workout` is acked. |
| D6 | One drainer at a time: the worker takes `navigator.locks.request('gymup-sync', …)`; where Web Locks is missing it proceeds (replays are idempotent). |
| D7 | `SyncBootstrap` (island, `client:idle`, in `app-layout.astro`) starts the worker on every page, so an outbox left by an offline finish drains from the dashboard too. |
| D8 | The layouts load Oswald/Inter from Google Fonts (cross-origin). The SW caches `fonts.googleapis.com` and `fonts.gstatic.com` cache-first in `gymup-fonts-v1`. Self-hosting fonts is out of scope. |
| D9 | `astro preview` is not available with the Vercel adapter. E2E builds with `E2E=1` (`@astrojs/node`, standalone) and runs `node dist/server/entry.mjs`. If `astro preview` works with the installed adapter version, use it and skip `@astrojs/node`. |
| D10 | `fake-indexeddb` is used as an in-memory, spec-faithful IndexedDB for vitest. It is a fake, not a mock, in the same sense as the fake transport of `sync-worker.test.ts` (ADR-009 holds). |
| D11 | AC-R12-04 is verified with the DevTools Application → Manifest installability pane plus an automated criteria test, because Lighthouse 12+ no longer has a PWA category. |
| D12 | `purgeTombstones(before)` keeps its signature. On Supabase, RLS limits the delete to the caller's own rows; on SQLite it removes every user's expired tombstones (dead rows, harmless). |
| D13 | The SW intercepts navigations to `/logout` and deletes the page caches before passing the request on (privacy on a shared phone). The outbox is not touched. |
| D14 | `IndexedDbOutboxStore` lives in `sync/indexed-db-outbox.ts` (the readme lists it in `outbox.ts`) so SSR never imports `indexedDB` code. |
| D15 | Multi-user devices: entries of user A drained under user B's session get `403` and move to `outbox_failed` (the 4xx rule). Per-user outboxes are out of scope. |
| D16 | A workout started offline carries `offlineStart: true` in its initial state (additive field of `LiveWorkoutInitialState`); chips show "Sugerencia sin conexión" while it is true. |
| D17 | The `outbox_failed` banner ("N cambios no se pudieron guardar") has no retry action (spec shows only the banner). Entries stay in the store for diagnosis. |

## Acceptance Criteria

- AC-12.3-01 (migration 011, both backends): `workout_exercises.deleted_at` and `workout_entries.deleted_at` exist on SQLite (Drizzle) and Supabase with `idx_workout_exercises_live` and `idx_entries_live`; `tests/workout-tracking/phase-1-fixture.regression.test.ts` (fixture `tests/fixtures/phase-1.db`) still returns the same history, set counts, volumes and progress numbers.
- AC-12.3-02 (tombstones): `RemoveExerciseUseCase` and `DeleteSetUseCase` set `deleted_at` (and `updated_at`) to the command's `updatedAt` instead of deleting; removing an exercise tombstones its live sets with the same stamp; `position` and `set_number` are re-densified among live rows only; the rows stay in the table until purged.
- AC-12.3-03 (LWW, [ADR-025 §5](../../../architecture/decisions/025-offline-live-workout.md)): an upsert with an older `updatedAt` than the stored live row returns `outcome: 'stale'` and changes nothing; a newer one updates; replays return 200; an upsert on a tombstoned id returns `stale` (D4); a repeated delete returns `stale`/200, never an error. Two simulated devices editing the same set converge to the newest write.
- AC-12.3-04 (reads): a tombstoned set or exercise is invisible to the live state, summary, history volumes, stats, PR counts and baselines, previous-set lookups, rotation queries, the social feed and detail, and the CSV export; `tests/workout-tracking/tombstone-reads.test.ts` seeds one tombstoned set and asserts each reader.
- AC-12.3-05 (purge): `PurgeTombstonesUseCase.execute({ now? })` hard-deletes sets and exercises with `deleted_at < now − 30 days` (a row at 29 days stays, at 31 days goes) and returns the count; it runs after a successful login without delaying or failing the login response, even when it throws.
- AC-12.3-06 (RLS, `STORAGE_BACKEND=supabase`): `tests/supabase/rls-tombstones.integration.test.ts` proves, as a **non-owner**, that updating `deleted_at` on another user's `workout_exercises` or `workout_entries` affects 0 rows and that deleting their tombstoned rows (the purge) affects 0 rows; the owner can tombstone and purge their own rows.
- AC-12.3-07 (manifest, NFR-WT-P2-05): `manifest.webmanifest` has name "Gym Up", `display: standalone`, `start_url: /dashboard`, `theme_color`, `background_color`, icons 192 and 512 (plus a maskable 512) whose files exist with those dimensions; both layouts link it; `apple-touch-icon` and the `apple-mobile-web-app-*` metas exist; Chrome DevTools shows no installability errors on a production build and the app installs on Android Chrome and iOS Safari (manual checklist).
- AC-12.3-08 (service worker lifecycle): the SW registers only in production (D2); on install it precaches `gymup-shell-v{build}`; on activate it deletes older `gymup-*` caches; after one online visit the user can reload `/dashboard` and open a workout with the network off.
- AC-12.3-09 (routing): `classifyRequest` returns: network-first for whitelisted HTML (D3); stale-while-revalidate for `GET /api/exercises` and `GET /api/routines/*`; cache-first for fonts (D8); pass-through (never cached) for `POST/PUT/PATCH/DELETE`, `/login`, `/register`, `/logout`, `/api/auth*` and every other API; the shell for `/workout/<id>` navigations when the network fails; `/offline.html` for other failed navigations. `/logout` clears the page caches (D13). Offline, the dashboard feed section shows "Sin conexión" instead of cards.
- AC-12.3-10 (update prompt): when a new SW reaches `installed` while the page is controlled, `UpdateBanner` shows "Nueva versión disponible — Recargar". The page never reloads by itself (no automatic `skipWaiting` mid-workout); tapping *Recargar* posts `SKIP_WAITING`, waits for `controllerchange` and reloads once.
- AC-12.3-11 (IndexedDB stores): database `gymup` v1 has `outbox` (`seq` auto-increment, `{ command, payload, createdAt, attempts }`), `outbox_failed` and `sessions` (key `workoutId`); `IndexedDbOutboxStore` passes the same contract suite as `MemoryOutboxStore` (`enqueue` returns increasing `seq`, `peek` returns the lowest, `ack`, `bumpAttempts`, `moveToFailed`, `removeByWorkout`, `counts`) and its data survives closing and reopening the database.
- AC-12.3-12 (snapshot, NFR-WT-P2-03): `use-live-workout` saves the reducer state to `sessions[workoutId]` on every action; a reload online or offline restores it with `state/restored` and the island prefers it over the SSR prop (D5); the snapshot is removed after `finish-workout` / `discard-workout` is acked; killing the tab or restarting the phone loses no logged set.
- AC-12.3-13 (sync worker): it drains in `seq` order, one entry at a time, on `kick()`, the `online` event, every 15 s while online and on `visibilitychange` → visible. `2xx` (including `stale`) acks; `401` pauses with "Inicia sesión para sincronizar" (not failed); other `4xx` → `outbox_failed` plus the banner "N cambios no se pudieron guardar" while later commands keep draining; `5xx` or network error → persisted `attempts` + retry after `min(2^attempts, 300)` seconds (table below), surviving reloads. A single drainer runs across tabs (D6) and `SyncBootstrap` drains pending entries on any page (D7).
- AC-12.3-14 (offline start, [ADR-025 §6](../../../architecture/decisions/025-offline-live-workout.md)): with the dashboard cached and the network off, *Empezar* builds the skeleton from the cached payload, writes the snapshot, enqueues `start-workout`, opens `/workout/[id]` via the shell, labels suggestions "Sugerencia sin conexión" (D16) and skips the readiness step and the `exercise-context` fetch; after reconnecting, the workout exists on the server exactly once.
- AC-12.3-15 (E2E, AC-R12-03, `STORAGE_BACKEND=sqlite`): Playwright with `context.setOffline(true)`: start the next routine, log 10 sets, reload mid-way (sets still present), finish ("Entrenamiento terminado · pendiente de sincronizar"), go online → the outbox drains, the summary opens and `GET /api/workouts/[id]/live-state?mode=edit` returns exactly 10 completed sets with unique ids. The median of 10 set checks updates the UI in < 100 ms while offline (NFR-WT-P2-02).
- AC-12.3-16 (NFR-WT-P2-04): at a 360 × 740 viewport the live-workout controls (set check, inputs, *Terminar*) have tap targets ≥ 44 px, and weight / reps inputs carry `inputmode="decimal"` / `"numeric"`.
- AC-12.3-17 (Phase 1 compatibility): with `STORAGE_BACKEND=sqlite|supabase` and the Phase 1 fixture, Phase 1 workouts keep rendering after migration 011 (names, sets, charts).

## Tasks

- [ ] `T12.3-01` - Schema: `deletedAt` in `db/schema.ts`, `drizzle-kit generate --name offline_sync`, `supabase/migrations/011_offline_sync.sql`; re-run the Phase 1 fixture regression.
- [ ] `T12.3-02` - SQLite repositories: tombstone writes, `stale` on tombstoned ids, live-only reads, renumbering among live rows, `purgeTombstones`; extend `sqlite-workout-exercise.repository.test.ts`, `upsert-set`, `delete-set`, `remove-exercise` use-case tests.
- [ ] `T12.3-03` - Supabase repositories: same behaviour (`.is('deleted_at', null)` on reads, `update({ deleted_at })` for removals, purge delete).
- [ ] `T12.3-04` - Read-path audit across progress, social, routines, progression and the CSV export; add `deleted_at IS NULL` everywhere; `tombstone-reads.test.ts`.
- [ ] `T12.3-05` - `PurgeTombstonesUseCase`, composition export, non-blocking call in `login.astro`; use-case test with `now` injected (29 vs 31 days).
- [ ] `T12.3-06` - `tests/supabase/rls-tombstones.integration.test.ts` (non-owner and owner cases, same gate as `rls-workout.integration.test.ts`).
- [ ] `T12.3-07` - Icons (192, 512, maskable, 180, 32), `manifest.webmanifest`, layout links and metas; `tests/pwa/manifest.test.ts` (JSON fields, PNG dimensions read from the IHDR chunk).
- [ ] `T12.3-08` - `public/sw.js`: precache, activate cleanup, routing (`classifyRequest` exported through `module.exports` when defined, so vitest can import it), fonts, logout cache clear, offline fallbacks, `SKIP_WAITING`; `public/offline.html`; `tests/pwa/sw-classify.test.ts`.
- [ ] `T12.3-09` - `sw-stamp` integration and `astro.config.mjs` wiring; `tests/pwa/sw-stamp.test.ts` (placeholders replaced, `_astro/*` listed).
- [ ] `T12.3-10` - `register-service-worker.ts` (prod only) and `update-banner.tsx`; `tests/pwa/register-service-worker.test.ts` with a hand-written `ServiceWorkerContainer`-shaped fake.
- [ ] `T12.3-11` - `idb.ts` and `IndexedDbOutboxStore`; shared `outbox-store.contract.ts` run against both stores; `indexed-db-outbox.test.ts` with `fake-indexeddb`.
- [ ] `T12.3-12` - `SessionStore` / `IndexedDbSessionStore`; `use-live-workout` saves on every action, hydrates from the snapshot (D5), cleans up on ack; `session-store.test.ts`.
- [ ] `T12.3-13` - Sync worker durability: persisted attempts and backoff, startup drain, Web Locks drainer (D6), 401 pause, `outbox_failed` banner; `SyncBootstrap` (D7); extend `sync-worker.test.ts`.
- [ ] `T12.3-14` - Offline shell page `/offline/workout-shell` and the SW fallback for `/workout/<id>`; island hydrates from `sessions` with `client:only="react"`.
- [ ] `T12.3-15` - `NextWorkoutCard` offline start (cached payload, `offlineStart`, snapshot write) and `FeedList` "Sin conexión" state.
- [ ] `T12.3-16` - Playwright setup: dependencies, `playwright.config.ts` (`webServer` builds with `E2E=1` and starts the node server; `STORAGE_BACKEND` from env), `test:e2e` script, helpers (`registerUser`, `adoptFirstTemplate` through the story 8.4 UI, `waitForServiceWorker`).
- [ ] `T12.3-17` - `offline-live-workout.e2e.spec.ts` (AC-12.3-14, -15, -16).
- [ ] `T12.3-18` - `pwa.e2e.spec.ts` (SW controls the page, manifest reachable, offline reload of `/dashboard`, `/offline.html` for an uncached page, `/logout` clears page caches) plus the manual installability checklist (Android Chrome install, iOS Add to Home Screen, DevTools installability, `sw.js` served with `max-age=0, must-revalidate` on the first Vercel preview, update prompt with two local builds).
- [ ] `T12.3-19` - Update docs: mark `PurgeTombstonesUseCase` `implemented`, record the offline pieces in `system.md` and the live-workout flow, fix doc/code drift found (`IndexedDbOutboxStore` file, `dashboard` missing icon files), add Implementation Evidence.

## Test Plan

Backoff (`sync-worker.test.ts`, `retryDelaySeconds(attempts) = min(2^attempts, 300)`):

| attempts | 0 | 1 | 2 | 3 | 8 | 9 | 20 |
|---|---|---|---|---|---|---|---|
| delay (s) | 1 | 2 | 4 | 8 | 256 | 300 | 300 |

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/workout-tracking/sqlite-workout-exercise.repository.test.ts` | repo | Tombstone writes, `stale` on tombstoned id, older vs newer `updatedAt`, renumbering among live rows, purge (02, 03, 05) |
| `tests/workout-tracking/{upsert-set,delete-set,remove-exercise}.use-case.test.ts` | use-case | Replays return 200, repeated delete, two-device convergence (03) |
| `tests/workout-tracking/tombstone-reads.test.ts` | integration | Every reader excludes a tombstoned set (04) |
| `tests/workout-tracking/purge-tombstones.use-case.test.ts` | use-case | 29 vs 31 days with `now` injected, returned count, exercises and sets (05) |
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` | integration | Phase 1 numbers unchanged after migration 011 (01, 17) |
| `tests/workout-tracking/indexed-db-outbox.test.ts` (+ `outbox-store.contract.ts`) | repo | Contract parity with `MemoryOutboxStore`, persistence across reopen (11) |
| `tests/workout-tracking/session-store.test.ts` | repo | Save, load, delete, replace by `workoutId` (12) |
| `tests/workout-tracking/sync-worker.test.ts` | unit | Order, one at a time, 2xx / stale / 401 / 4xx / 5xx, backoff table, persisted attempts across a new worker instance, single drainer (13) |
| `tests/pwa/manifest.test.ts` | unit | Manifest fields and icon dimensions (07) |
| `tests/pwa/sw-classify.test.ts` | unit (table) | Each request kind → strategy; auth and non-GET never cached; logout clears (09) |
| `tests/pwa/sw-stamp.test.ts` | unit | Placeholders replaced, precache list (08) |
| `tests/pwa/register-service-worker.test.ts` | unit | Prod-only registration, banner on `installed` while controlled, no auto reload, `SKIP_WAITING` then one reload (08, 10) |
| `tests/supabase/rls-tombstones.integration.test.ts` | integration-RLS | Non-owner cannot tombstone or purge another user's rows (06) |
| `tests/e2e/offline-live-workout.e2e.spec.ts` | e2e | Offline start, 10 sets, reload, finish, reconnect, exactly-once, < 100 ms median, 360 px tap targets (14, 15, 16) |
| `tests/e2e/pwa.e2e.spec.ts` | e2e | SW control, offline dashboard reload, offline fallback, logout clearing (08, 09) |

## Out of Scope

- Background Sync API and push notifications (Safari lacks the former; PRD excludes push).
- Offline feed, stats, AI summary: they show "Sin conexión" ([ADR-025 §1](../../../architecture/decisions/025-offline-live-workout.md)).
- Offline readiness check-in (skipped offline) and offline starts other than the dashboard's next routine (*Elegir otra rutina*, empty, repeat are online-only).
- Per-user outboxes on shared devices (D15), retry or discard UI for failed commands (D17), outbox compaction beyond the 500 ms `upsert-set` coalescing.
- Live push of changes between two devices; a device sees the other's edits after its next reload.
- Parity E2E on both backends → [story-12.5](./story-12.5.md).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
