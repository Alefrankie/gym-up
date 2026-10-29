---
id: ADR-027
title: Mobile Architecture — NestJS API, SvelteKit Static SPA, Tauri 2
type: decision
status: proposed
date: 2026-10-29
---

# ADR-027: Mobile Architecture — NestJS API, SvelteKit Static SPA, Tauri 2

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Proposed. The product owner decided on 2026-10-29: NestJS, SvelteKit SPA, Tauri 2, a Turborepo monorepo, remote push notifications **out of scope** for the first release, and Phase 2 features **built directly in the new stack**. Authentication stays simple (email and password, no OAuth). **Cloudflare is the platform** (Workers for the API and web, D1 database, R2 photos); Supabase is dropped. The Phase 0 deploy checks in [Cloudflare evaluation](#cloudflare-evaluation) can still send us to a fallback. Items under [Open questions](#open-questions) are not settled and block the phases that depend on them. Execution order is in the [migration plan](../../planning/mobile-migration-plan.md).

## Context

Gym Up is an Astro app (`output: 'server'`, Vercel adapter) with React islands, cookie sessions (argon2, SQLite sessions), Drizzle on `better-sqlite3`, Gemini calls from the server, and `/api/*` routes living inside the Astro project. The goal is a **mobile app** (Android first). The app is highly interactive (live workout, timers, charts, offline logging), which is where Astro's content-first model helps least.

Constraints found while evaluating Tauri 2 mobile against the current code:

| Constraint | Effect on the current design |
|------------|------------------------------|
| Tauri serves a **static bundle** from a custom scheme (`tauri://localhost` on iOS, `http://tauri.localhost` on Android) | No SSR in the mobile build. Pages that read the DB on the server must load data from an API. |
| Service workers are **not reliable** under those schemes | The PWA shell and runtime caching of [ADR-025](./025-offline-live-workout.md) cannot be the offline mechanism. |
| The app origin differs from the API origin | Cookie sessions do not work cross-origin. Auth needs bearer tokens and CORS. |
| `better-sqlite3` is process-local and synchronous | It does not fit a stateless serverless API and cannot run in the app. |
| WebView is suspended when the screen is off | Rest-timer alerts need OS-scheduled local notifications. |

## Decision

### 1. Three deployables in one monorepo (pnpm workspace + Turborepo)

`turbo.json` defines the task graph (`build`, `dev`, `lint`, `typecheck`, `test`) with caching, so `packages/contracts` builds before `apps/api` and `apps/app`. The existing repo `Alefrankie/gym-up` is adapted in place (no new repository); work lands through branches and pull requests.

```
apps/api        NestJS (Express adapter) — the only server
apps/app        SvelteKit static SPA + src-tauri (Tauri 2) — web build and Android/iOS build from one codebase
packages/contracts   zod schemas + inferred types shared by api and app (request/response DTOs)
```

The Astro project is retired at the end of the migration (strangler pattern, never a big bang).

### 2. Backend: NestJS

- NestJS on the **Express** adapter (`@nestjs/platform-express`), TypeScript, one Nest module per bounded context (`auth`, `workout-tracking`, `progress`, `private-photos`, `public-view`, `nutrition`, plus the Phase 2 contexts as they are built).
- The existing hexagonal layout ([ADR-013](./013-hexagonal-architecture.md)) carries over: `domain` and `application` code (use cases, repository ports) move **unchanged**; Nest controllers replace Astro API routes; Nest providers replace the hand-written `*.composition.ts` files ([ADR-010](./010-per-context-composition.md)). Abstract classes stay as interfaces ([ADR-011](./011-implements-not-extends.md)) and are used as Nest injection tokens.
- Drizzle remains the data layer ([ADR-012](./012-drizzle-orm.md)). Production target is **D1** (SQLite). The Drizzle schema stays SQLite; the `STORAGE_BACKEND` switch and the Supabase repositories are deleted.
- Validation: zod schemas from `packages/contracts`, applied at the controller boundary. OpenAPI generated with `@nestjs/swagger`.
- Auth stays **simple**: email and password as today (decided 2026-10-29, no OAuth). The cookie session of `LocalAuthService` is replaced by an opaque bearer token stored server-side in the `sessions` table (same model as today, sent in the `Authorization` header), because cookies do not work cross-origin from the Tauri app. Password hashing on Workers: see open question 2.
- Idempotent upserts by client-generated UUID, `updated_at` last-write-wins, and tombstones from [ADR-025](./025-offline-live-workout.md) §3 and §5 are implemented in the API from the first workout endpoint.
- Secrets (`GEMINI_API_KEY`, DB URL) exist only in the API environment.

### 3. Frontend: SvelteKit as a static SPA

- SvelteKit with `@sveltejs/adapter-static`, `ssr = false`, `prerender = false`, SPA fallback `index.html`. This is the setup the Tauri documentation prescribes.
- Svelte 5 with runes. Live workout state is a single rune-based store with a reducer, replacing the React island of [ADR-015](./015-live-workout-react-island.md); the outbox contract of ADR-015 does not change.
- Chart.js is used directly (no wrapper); it supersedes the React-island part of [ADR-002](./002-chartjs-react-island.md).
- API client: one typed module built on `fetch` and the `packages/contracts` types. It attaches the bearer token, refreshes it once on 401, and **reads through an IndexedDB cache** (see §5).
- No server-only code or `$env/*/private` in the app.

### 4. Shell: Tauri 2

- Same SvelteKit build is the web app and the Tauri webview content. Platform differences go behind a small `platform` module (camera, notifications, secure storage) so web keeps working.
- Official plugins first: local notifications, haptics, dialog, deep-link, store/os. Rust is limited to `lib.rs` plugin registration, `tauri.conf.json` and `capabilities/*.json`. **Remote push notifications are out of scope** for the first release (decided 2026-10-29); only OS-scheduled local notifications are used (rest timer). The social feed and weekly coach summary are visible in-app only.
- Android first. iOS needs a Mac with Xcode and an Apple Developer account and is a later phase.
- Dev loop: `tauri android dev` with Vite HMR on a USB or emulator device.

### 5. Offline model (amends ADR-025)

| ADR-025 element | Status under this ADR |
|-----------------|-----------------------|
| IndexedDB `outbox`, `outbox_failed`, `sessions` stores | **Kept** unchanged |
| Client-generated UUIDs, idempotent upserts, last-write-wins, tombstones | **Kept** unchanged |
| Service worker, precache, `manifest.webmanifest` | **Dropped** from the SPA. In Tauri the assets are bundled in the app. A web PWA is optional and out of scope. |
| Runtime SWR caching of `GET /api/exercises`, `GET /api/routines/*`, last-cached pages | **Replaced** by a read-through cache in the API client (IndexedDB, keyed by URL, versioned). |
| "Starting offline" from cached next-routine payload | **Kept**, served from the client cache |

ADR-025 should be marked as partially superseded when this ADR is accepted.

### 6. Versions

Use the latest stable releases at implementation time and pin exact versions in the lockfile. Registry check on 2026-10-29:

| Package | Latest |
|---------|--------|
| `svelte` | 5.57.3 |
| `@sveltejs/kit` | 3.1.0 |
| `@sveltejs/adapter-static` | 4.0.0 |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 |
| `vite` | 8.3.5 |
| `@tauri-apps/cli` / `@tauri-apps/api` | 2.12.4 |
| `@nestjs/core`, `@nestjs/platform-express` | 12.3.2 |
| `@nestjs/cli` | 12.0.11 |
| `@nestjs/config` / `@nestjs/swagger` / `@nestjs/jwt` | 12.0.1 / 12.0.5 / 12.0.3 |
| `drizzle-orm` | 0.45.4 |
| `zod` | 4.6.7 |
| `typescript` | 7.0.2 |
| `vitest` | 5.0.5 |
| `chart.js` | 4.6.1 |
| `argon2` | 0.45.1 |
| Node (dev machine) | 26.12.1 |

These are the newest releases the registry reported, not a tested combination. Phase 0 of the plan must install them together and confirm peer dependencies (notably the Nest 12 and Vite 8 toolchains against TypeScript 7, and `drizzle-orm` against the chosen Postgres driver). Where a package forces an older release of another, record the exception in this ADR.

## Rationale

- A separate API is the only way to serve both the web build and a static Tauri bundle; SSR cannot exist inside the app.
- NestJS gives modules, DI and a standard structure that map one-to-one to the existing bounded contexts, and keeps the domain code reusable.
- SvelteKit static SPA removes SSR we cannot use on mobile, and Svelte's fine-grained reactivity suits timers, live sets and charts.
- One frontend codebase for web and mobile avoids maintaining two UIs.
- Keeping the ADR-025 outbox protocol means the offline sync design does not have to be redone, only its transport and caching layer.

## Trade-offs

- **Pro:** One API, one UI codebase, shared contracts, domain logic reused.
- **Pro:** Secrets and Gemini stay server-side.
- **Con:** Rewrite of every Astro page and React island into Svelte. The live workout is the largest piece.
- **Con:** A server that must be hosted (see open question 2), unlike the current Vercel-only setup.
- **Con:** Tauri mobile needs the Rust toolchain, Android Studio with SDK and NDK, and has fewer mobile plugins than Capacitor. Remote push in particular has no first-party plugin.
- **Con:** Stack is on very recent majors (Nest 12, Kit 3, Vite 8, TypeScript 7); ecosystem lag is likely.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Capacitor around the current stack | Lower risk and mature plugins, but the owner chose Tauri 2. Remains the fallback if Phase 0 or Phase 5 shows a blocking Tauri gap. |
| React Native + Expo | Full UI rewrite to native components; no reuse of the web UI. |
| Astro + Svelte islands, static | Keeps Astro for a highly interactive app where it adds little; two routing models. |
| Backend inside SvelteKit | Would couple the API to the web app; the mobile build is static and cannot host it. |

## Cloudflare evaluation

Decided 2026-10-29: replace Supabase with Cloudflare so API, database, storage and web hosting live in one place. The table records fit and risk; the Phase 0 gate validates the unverified rows on a real deployment.

| Piece | Cloudflare product | Fit |
|-------|--------------------|-----|
| API | Workers | **Main risk.** Workers is not Node. NestJS needs the `nodejs_compat` flag and the Express adapter. **Verified locally 2026-10-29, see the next section.** Not yet verified on deployed Cloudflare, with D1, or at startup under real load. |
| Database | D1 (SQLite) | **Good fit.** The code already runs on SQLite and Drizzle ([ADR-012](./012-drizzle-orm.md)), and Drizzle supports D1. It removes the Postgres versus SQLite split. Limits: no interactive transactions (only batched statements), per-database size cap, single primary region. Every multi-statement use case must be checked for this. |
| Photos | R2 | Good fit. S3-compatible, presigned URLs replace Supabase signed URLs ([ADR-005](./005-private-photos.md)). |
| Web hosting | Workers static assets / Pages | Good fit for the SvelteKit static build. |
| Auth | none first-party | Cloudflare has no end-user auth service like Supabase Auth (Cloudflare Access targets internal apps). Auth is built in the API with a library (for example Better Auth or Arctic) on D1. |
| Gemini calls | Workers `fetch` | Works; key stored as a Worker secret. |
| `argon2` | n/a | Native addon, does not run on Workers. Email+password needs a Workers-compatible hash (WASM argon2, scrypt, or WebCrypto PBKDF2); existing argon2 hashes must stay verifiable or be rehashed on next login. |

Consequences if adopted:
- Supabase is dropped (database, storage, and its RLS). Row-level visibility rules of [ADR-004](./004-rls-visibility.md) must live in the API; they have to exist there anyway.
- Existing SQLite data migrates with little dialect change.
- Build: Wrangler bundles with esbuild, which cannot emit decorator metadata. The API is therefore **transpiled with SWC first** (`decoratorMetadata: true`) and Wrangler only bundles the resulting JavaScript. **Verified on a deployed Worker** (see spike result).
- Fallbacks if Nest does not run acceptably on Workers: (a) keep Nest on a Node host and use D1 over its HTTP API or move to Postgres; (b) keep the hexagonal domain and replace Nest controllers with Hono, which is native to Workers. Either is chosen at the Phase 0 gate.

### Nest on Workers: spike result (2026-10-29)

A throwaway project (outside the repo) ran NestJS 12.3.2 with `@nestjs/platform-express` and Express 5 on Wrangler 4.155.0 in local mode (workerd), `compatibility_date` 2026-10-01 and the `nodejs_compat` flag, entry through `httpServerHandler` from `cloudflare:node`.

| Check | Result |
|-------|--------|
| Nest boots, router serves `GET /hello` with a provider injected | Works (`200`, ~20–100 ms locally) |
| Unknown route returns Nest's `404` JSON | Works |
| Bundle size | 3.1 MiB raw, 642 KiB gzip |
| Bundling | Fails until the optional packages Nest loads lazily (`@nestjs/microservices`, `@nestjs/websockets` modules) are aliased to an empty stub in `wrangler.jsonc` `alias`; `class-validator` and `class-transformer` are also resolved at bundle time |
| Constructor injection **without** `@Inject(Token)` | **Silently injects `undefined`.** esbuild (used by Wrangler) does not emit `emitDecoratorMetadata`. |

Rules that follow: every constructor parameter uses an explicit `@Inject(Token)`, or the API is compiled with SWC/tsc before Wrangler; an ESLint rule must catch implicit injection. Boot Nest lazily inside the first request, not at module scope.

#### Deployed check, run 1 (real Cloudflare account, 2026-10-29)

Same app, now **transpiled with SWC** (`decoratorMetadata: true`, `legacyDecorator: true`, ES modules out) and bundled by Wrangler from the compiled JavaScript. Deployed with `wrangler deploy`, D1 bound, then deleted (Worker and database removed afterwards).

| Check | Result |
|-------|--------|
| Implicit constructor injection (no `@Inject`) after SWC | **Works** (`svcIsDefined: true`) |
| Worker startup time reported by Wrangler | 58 ms |
| First request, includes lazy Nest boot | ~120 ms measured from the dev machine; later requests ~50–60 ms |
| Drizzle (`drizzle-orm/d1`) select, insert, `db.run` | Works |
| Interactive `db.transaction()` on D1 | **Fails**: D1 rejects `BEGIN TRANSACTION` |
| `db.batch([...])` | **Atomic**: a batch with a duplicate key rolled back the whole batch (no partial rows) |
| WebCrypto PBKDF2 | Capped at **100 000 iterations** (600 000 is rejected); below the usual OWASP guidance for SHA-256 |

The current code has **no** `.transaction(` calls (searched `src/` and `db/`), so D1's limitation does not block porting today. Multi-statement writes must use `db.batch`; read-then-write logic that needs isolation must be redesigned (for example with conditional updates or a Durable Object).

#### Deployed check, run 2: real code on D1 (2026-10-29)

A second, independent run used the **repository's real code unchanged**: `db/schema.ts`, all five migrations in `db/migrations`, `SqliteWorkoutRepository` and `CompleteWorkoutUseCase`. Only a Nest controller and factory providers were written (the use case is a plain class, so it is bound with `useFactory` and the domain code stays free of Nest decorators). Build: SWC to ES modules with path aliases resolved, Wrangler bundling the output. Deployed to a Worker with a D1 binding in region WEUR (colo LIS), then the Worker was deleted.

| Check | Result |
|-------|--------|
| Implicit constructor injection after SWC (`design:paramtypes` emitted) | **Works** |
| `wrangler d1 migrations apply` with the five existing SQLite migrations | Applied unchanged, local and remote |
| `SqliteWorkoutRepository` and the use case against D1 | Work with no code changes (the repository was already `async`; only a type-only `Db` import needed an alias) |
| `POST /workouts/:id/complete` | `201` complete, `201` on repeat (AC-2.6-05 holds), `400` no entries, `403` other user, `404` unknown id: same error mapping as today |
| Worker startup time reported by Wrangler | 50 ms on the first deploy, 52 ms on a redeploy (limit 1 s) |
| Bundle | 2.5 MiB, 533 KiB gzip |
| First request after deploy (lazy Nest boot) | 168 ms from the dev machine, against about 37 ms warm: roughly 130 ms of cold overhead |
| Warm `complete-workout`, 15 runs, from the dev machine | min 107 ms, median 118 ms, max 153 ms (four sequential D1 queries) |
| Interactive `db.transaction()` | **Fails** with `D1_ERROR: To execute a transaction, please use the state.storage.transaction() ... APIs instead of the SQL BEGIN TRANSACTION or SAVEPOINT statements` |
| `db.batch([...])` with one failing statement | **Atomic**: the whole batch rolled back, no partial row |
| WebCrypto PBKDF2 on the deployed Worker | `100000` iterations ok; `100001`, `210000` and `600000` rejected with "iteration counts above 100000 are not supported" |

Notes:
- **`wrangler dev --local` does not enforce the PBKDF2 cap** (600 000 iterations ran locally and failed in production). Any check involving Workers limits must run on a deployed Worker.
- `Date.now()` is frozen inside a Worker until I/O happens, so timing Nest's boot from inside the Worker reads 0 ms. Cold overhead is inferred from first versus later requests instead.
- Both runs agree on SWC, D1 transactions, `db.batch` and the PBKDF2 cap. Their startup figures differ slightly (58 ms against 50 and 52 ms), which is normal variation.

Still not verified: R2 presigned uploads, a password hash with adequate cost on Workers (PBKDF2 at 100k, scrypt or argon2 in WASM, within Worker CPU limits), the real module set under load, and Tauri against this API.

## Open questions

These are **not decided** and must be answered before the marked phase starts.

1. ~~Cloudflare versus Supabase~~ **Resolved 2026-10-29: Cloudflare.** The deploy gate passed on 2026-10-29 for SWC, startup time, D1 and batch (see the spike results); R2, the password hash and Tauri remain open in Phase 0. The fallbacks above stay available.
2. **Password hashing on Workers (before Phase 2).** WebCrypto PBKDF2 is capped at 100 000 iterations on Workers. Choose WASM argon2, scrypt or PBKDF2 within that cap and decide whether to rehash existing argon2 hashes on next login. Only relevant if Cloudflare is adopted.
3. **Token storage in the app (before Phase 3).** Options: OS-backed secure storage via a plugin versus `plugin-store`. Web build needs a separate answer (memory plus refresh cookie versus storage).
4. ~~Photo storage~~ **Resolved: R2** with presigned URLs.

Resolved 2026-10-29: remote push is out of scope for the first release; Phase 2 contexts (routines, exercise library, progression, body metrics, social) are built directly in Nest and Svelte, so Phase 2 delivery pauses until the new stack can host them.

## Consequences

- New workspace layout and a `docs/planning/mobile-migration-plan.md`.
- [ADR-001](./001-supabase-client-side.md) (browser talks to Supabase) is superseded in practice: the app talks only to the API.
- [ADR-002](./002-chartjs-react-island.md) and [ADR-015](./015-live-workout-react-island.md) are superseded by the Svelte equivalents; [ADR-025](./025-offline-live-workout.md) is partially superseded (§5 above).
- Auth contract changes from cookie sessions to a bearer session token; password hashes carry over (see open question 2).
- CORS allow-list for the web origin and the Tauri origins (`tauri://localhost`, `http://tauri.localhost`).
- Stories in `docs/stories/phase-2` need re-scoping against the new stack.
