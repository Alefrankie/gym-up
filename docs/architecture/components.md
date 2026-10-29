# UI Components

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

> **Updated 2026-10-29.** The Astro components (`*.astro`, React islands) were removed in Phase 1 of the [mobile migration](../planning/mobile-migration-plan.md). They remain readable at the git tag `pre-migration`, for example `git show pre-migration:src/components/exercise-card.astro`. This page describes the Svelte 5 app in `apps/app`.

## Conventions

| Topic | Rule |
|-------|------|
| Files | kebab-case for routes, helpers and stores (`workout-session.ts`); PascalCase for Svelte components (`AppNav.svelte`) |
| Runes | State uses `$state`, `$derived` and `$props`. Shared reactive state is a class in a `*.svelte.ts` file (`session.svelte.ts`, `sync.svelte.ts`) |
| Imports | `#lib/...` maps to `src/lib/...` (package.json `imports`). Files that must also run in plain Vitest (the offline engine) use relative imports |
| Data | Components never call `fetch`. They use `api()` or `cachedGet()` with a schema from `@gym-up/contracts` |
| Errors | `NetworkError` means "no signal" (show cached data or queue the change); `ApiRequestError` means the server rejected the request (show its message) |
| Language | UI text is Spanish; code, comments and docs are English |
| Styling | Global tokens and utility classes in `src/app.css` (`--bg`, `--surface`, `--accent`, `.card`, `.list`, `.muted`, `.error`, `.ok`); component-specific rules in the component's `<style>` |

## Routes (`src/routes`)

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/dashboard` or `/login` depending on the stored token |
| `/login`, `/register` | Forms; on success store the token and seed the cached user (`session.set`) |
| `/dashboard` | Today's workout from the cache-backed `GET /workouts/today`; starts or continues a workout locally first |
| `/workout/[id]` | Local-first set logging: rows are persisted to IndexedDB, queued in the outbox, with a rest timer and a finish action |
| `/history` | Paginated history from the cache-backed `GET /workouts` |
| `/nutrition` | Daily summary and calorie goal, meal photo analysis or manual entry, history with delete |
| `/photos` | Private progress photos: capture or pick, compressed on the device, thumbnails fetched with the bearer token |
| `/settings` | Name, weight unit, routine type, account and sign-out |
| `/more` | Links to Historial, Fotos and Ajustes |
| `/progress` | Streak, 28-day calendar and a per-exercise Chart.js line chart (max weight or volume, 7 days, 30 days or all) |
| `/family`, `/family/[id]` | Every member's workout count, streak and dates (read-only; never photos or body data) |

## Shared components (`src/lib/components`)

| Component | Role |
|-----------|------|
| `AppNav.svelte` | Fixed bottom navigation (Inicio, Progreso, Comida, Familia, Más) |
| `SyncBanner.svelte` | Pending and failed sync counts, with Retry and Discard actions for rejected commands |
| `ProgressChart.svelte` | Chart.js line chart created once and updated in place when its props change |

## Non-visual building blocks (`src/lib`)

| Module | Role |
|--------|------|
| `api/client.ts` | Typed fetch wrapper: bearer token, 10 s timeout, schema validation, 401 clears the token |
| `api/token.ts` | `TokenStore` over `localStorage` (replaceable by secure storage in the Tauri build) |
| `session.svelte.ts` | Current user, `require()` guard for pages, `signOut()` |
| `offline/idb.ts` | IndexedDB wrapper with the `outbox`, `failed` and `kv` stores |
| `offline/outbox.ts` | Command queue and in-order sync engine (backoff, retry, failed store, id remapping, coalescing) |
| `offline/sync.svelte.ts` | Reactive facade: pending count, online state, the sync loop |
| `offline/cache.ts` | Read-through cache for GET endpoints |
| `offline/workout-session.ts` | Local snapshot of the open workout and the `active-workout` pointer |
| `api/binary.ts` | Authenticated blob download, raw upload and delete (photos) |
| `image.ts` | On-device JPEG compression and base64 encoding |
| `notify.ts` | Android local notification for the end of the rest (no-op on the web) |
