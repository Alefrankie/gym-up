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
```

Pushing to `main` starts the GitHub Actions release pipeline. It chooses a version from Conventional Commits since the last `v*` tag (`feat` → minor, `fix`/other → patch, `!`/`BREAKING CHANGE` → major), deploys the API, builds and publishes the web app plus signed Android APK, then commits the version bump and pushes a `vX.Y.Z` tag. `pnpm release [major|minor|patch]` runs that release locally instead.

Before the first pipeline run, add these GitHub Actions repository secrets:

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for both Worker deployments.
- `GYM_UP_ANDROID_KEYSTORE_BASE64`, `GYM_UP_ANDROID_STORE_PASSWORD`, and `GYM_UP_ANDROID_KEY_PASSWORD` for the same signing key used by existing installs. Do not generate a replacement key; Android will reject updates signed with a different key.

The web deployment publishes `/update.json` with the APK version code, download URL, and SHA-256 checksum. Installed Android release builds check that file when they open and in Settings. If its version code is newer, the app offers the download and Android asks the user to approve installation.

## Notes

- `apps/app` pins TypeScript 6: SvelteKit 3 and svelte-check still use the TypeScript JS API, which TypeScript 7 no longer ships. The rest of the repo uses TypeScript 7.
- SvelteKit 3: options live in `vite.config.ts` (no `svelte.config.js`), `$lib` is `#lib` (package.json `imports`), and `tsconfig.json` extends `$app/tsconfig`.
- The Astro app was removed in Phase 1. Its code is at the `pre-migration` tag: `git show pre-migration:src/pages/dashboard.astro`.
