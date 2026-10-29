# Implementation Trace

Parent: [../README.md](../README.md)

Progress tracking and decision log.

## Status

| Phase | Status |
|-------|--------|
| Planning / Specs | ✅ Complete |
| Project setup | ✅ Complete |
| Implementation | ✅ Phase 1 app migrated to NestJS + SvelteKit + Tauri; see the mobile migration plan |
| Deployment | ✅ API and web on Cloudflare (workers.dev); debug APK installed on a phone |
| Phase 2 specs | ✅ Complete (2026-10-01) — [stories/phase-2](../stories/phase-2/readme.md) |
| Phase 2 implementation | ⏳ Pending: specs are written against the old stack and are being re-based on ADR-027 |

## Decisions Log

| Date | Decision | Impact |
|------|----------|--------|
| 2026-07-21 | Stack: Astro + Supabase + Vercel | Foundation |
| 2026-07-21 | RLS model: write own, read all | Data access |
| 2026-07-21 | Photos private, not in family view | Privacy |
| 2026-07-21 | Routines as seed data | Data model |
| 2026-07-21 | Store in kg, display per unit | Weight handling |
| 2026-10-01 | Phase 2 scope: Hevy + Gravl parity, tie-break Hevy → Gravl → simplest | [stories/phase-2](../stories/phase-2/readme.md) |
| 2026-10-01 | Live workout = one client-state screen + outbox ([ADR-015](../architecture/decisions/015-live-workout-react-island.md); the React island became a Svelte screen under ADR-027) | UI architecture |
| 2026-10-01 | Workout model v2: workout_exercises, set types, RPE, exercise-type metrics; relaxed session rules ([ADR-016](../architecture/decisions/016-workout-data-model-v2.md)) | Data model |
| 2026-10-01 | Exercise catalog: system + custom ([ADR-017](../architecture/decisions/017-exercise-catalog.md)) | Data model |
| 2026-10-01 | User-owned programs supersede seeded routines ([ADR-018](../architecture/decisions/018-user-owned-programs.md) supersedes ADR-003) | Data model |
| 2026-10-01 | Rotation scheduling + rule-based recommendation ([ADR-019](../architecture/decisions/019-rotation-scheduling-and-onboarding.md)) | Product |
| 2026-10-01 | PRs derived on demand, Epley ([ADR-020](../architecture/decisions/020-personal-records.md)) | Progress |
| 2026-10-01 | Deterministic progression engine ([ADR-021](../architecture/decisions/021-progression-engine.md)) | Coaching |
| 2026-10-01 | Readiness + derived recovery ([ADR-022](../architecture/decisions/022-readiness-and-recovery.md)) | Coaching |
| 2026-10-01 | Body metrics owner-only ([ADR-023](../architecture/decisions/023-body-metrics-privacy.md)) | Privacy |
| 2026-10-01 | Family feed + likes/comments, no follow graph ([ADR-024](../architecture/decisions/024-social-interactions.md)) | Social |
| 2026-10-01 | Offline live workout via IndexedDB outbox, LWW ([ADR-025](../architecture/decisions/025-offline-live-workout.md), amended 2026-10-29: no service worker, outbox implemented) | Platform |
| 2026-10-01 | Weekly AI summary: facts first, Gemini phrasing, cached ([ADR-026](../architecture/decisions/026-weekly-ai-coach-summary.md)) | AI |
| 2026-10-29 | Mobile architecture: NestJS API on Cloudflare Workers + SvelteKit static SPA + Tauri 2, in a Turborepo monorepo ([ADR-027](../architecture/decisions/027-mobile-architecture-nestjs-sveltekit-tauri.md)). Supersedes the Astro + Supabase + Vercel stack of 2026-07-21 | Foundation |
| 2026-10-29 | Cloudflare replaces Supabase (D1 SQLite, R2 for photos); RLS is replaced by ownership checks in the API | Data access |
| 2026-10-29 | Auth stays email and password: opaque bearer session token, argon2id WASM with a shared instance, no legacy hashes | Auth |
| 2026-10-29 | Astro removed in Phase 1; the old app is kept at the git tag `pre-migration` | Codebase |
| 2026-10-29 | Remote push notifications out of scope for the first release; Phase 2 features are built directly in the new stack | Scope |
| 2026-10-29 | Offline live workout: local-first snapshots plus an IndexedDB outbox with idempotent sync (no service worker) | Offline |
