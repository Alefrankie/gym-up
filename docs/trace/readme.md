# Implementation Trace

Parent: [../README.md](../README.md)

Progress tracking and decision log.

## Status

| Phase | Status |
|-------|--------|
| Planning / Specs | ✅ Complete |
| Project setup | ⏳ Pending |
| Implementation | ⏳ Pending |
| Deployment | ✅ API and web on Cloudflare (workers.dev); Android APK pending Developer Mode on the build machine |

## Decisions Log

| Date | Decision | Impact |
|------|----------|--------|
| 2026-07-21 | Stack: Astro + Supabase + Vercel | Foundation |
| 2026-07-21 | RLS model: write own, read all | Data access |
| 2026-07-21 | Photos private, not in family view | Privacy |
| 2026-07-21 | Routines as seed data | Data model |
| 2026-07-21 | Store in kg, display per unit | Weight handling |
| 2026-10-29 | Mobile architecture: NestJS API on Cloudflare Workers + SvelteKit static SPA + Tauri 2, in a Turborepo monorepo ([ADR-027](../architecture/decisions/027-mobile-architecture-nestjs-sveltekit-tauri.md)). Supersedes the Astro + Supabase + Vercel stack of 2026-07-21 | Foundation |
| 2026-10-29 | Cloudflare replaces Supabase (D1 SQLite, R2 for photos); RLS is replaced by ownership checks in the API | Data access |
| 2026-10-29 | Auth stays email and password: opaque bearer session token, argon2id WASM with a shared instance, no legacy hashes | Auth |
| 2026-10-29 | Astro removed in Phase 1; the old app is kept at the git tag `pre-migration` | Codebase |
| 2026-10-29 | Remote push notifications out of scope for the first release; Phase 2 features are built directly in the new stack | Scope |
| 2026-10-29 | Offline live workout: local-first snapshots plus an IndexedDB outbox with idempotent sync (no service worker) | Offline |
