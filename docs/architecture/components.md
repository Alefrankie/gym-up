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

## Shared components (`src/lib/components`)

| Component | Role |
|-----------|------|
| `AppNav.svelte` | Fixed bottom navigation (Inicio, Historial, Salir); sign-out warns about unsent changes |
| `SyncBanner.svelte` | Pending and failed sync counts, with Retry and Discard actions for rejected commands |

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

## Planned

Progress charts (Chart.js used directly, replacing the React island of [ADR-002](./decisions/002-chartjs-react-island.md)), photo capture and gallery, nutrition capture and history, the family feed and the settings page. They follow the same conventions and are tracked in the migration plan.
