# Gym Up

Workout tracker with routines, progress, photos and family sharing. Mobile app first (Android via Tauri 2).

Architecture and decisions: [ADR-027](docs/architecture/decisions/027-mobile-architecture-nestjs-sveltekit-tauri.md). Migration plan: [mobile-migration-plan](docs/planning/mobile-migration-plan.md).

## Layout

| Path | What |
|------|------|
| `apps/api` | Backend: domain and use cases per bounded context, Drizzle schema and migrations. NestJS on Cloudflare Workers from Phase 2. |
| `apps/app` | SvelteKit static SPA (web build and Tauri webview). |
| `packages/contracts` | zod schemas shared by api and app. |

## Commands

```sh
pnpm install
pnpm typecheck   # all packages
pnpm test        # all packages
pnpm build       # all packages
pnpm --filter @gym-up/app dev
pnpm --filter @gym-up/app android:debug   # debug APK on the connected Android phone
pnpm --filter @gym-up/app android:share   # signed release APK for sharing
pnpm --filter @gym-up/app deploy:web      # publish /descarga and the latest share APK to Cloudflare
```

Every deploy goes through `pnpm release` (or `pnpm release major|minor|patch`). It bumps the semver version from Conventional Commits since the last `v*` tag (`feat` → minor, `fix`/other → patch, `!`/`BREAKING CHANGE` → major), deploys the API and web/APK, then commits, tags `vX.Y.Z` and pushes. The web deploy generates `update.json` from the signed APK; installed Android apps check it on launch and from Settings.

## Notes

- `apps/app` pins TypeScript 6: SvelteKit 3 and svelte-check still use the TypeScript JS API, which TypeScript 7 no longer ships. The rest of the repo uses TypeScript 7.
- SvelteKit 3: options live in `vite.config.ts` (no `svelte.config.js`), `$lib` is `#lib` (package.json `imports`), and `tsconfig.json` extends `$app/tsconfig`.
- The Astro app was removed in Phase 1. Its code is at the `pre-migration` tag: `git show pre-migration:src/pages/dashboard.astro`.
