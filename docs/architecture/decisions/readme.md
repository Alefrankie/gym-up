# Architecture Decision Records

Parent: [../readme.md](../readme.md) · Up: [../../README.md](../README.md)

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./001-supabase-client-side.md) | Supabase Client-side SDK | ⛔ Superseded by [ADR-027](./027-mobile-architecture-nestjs-sveltekit-tauri.md) |
| [ADR-002](./002-chartjs-react-island.md) | Chart.js via React Island | ⛔ Superseded by [ADR-027](./027-mobile-architecture-nestjs-sveltekit-tauri.md) |
| [ADR-003](./003-routines-seed-data.md) | Routines as Seed Data | ⛔ Superseded by [ADR-018](./018-user-owned-programs.md) |
| [ADR-004](./004-rls-visibility.md) | RLS: write own, read all | ✅ Accepted |
| [ADR-005](./005-private-photos.md) | Private Progress Photos | ✅ Accepted |
| [ADR-006](./006-kg-storage.md) | Store in kg, display per unit | ✅ Accepted |
| [ADR-007](./007-repository-pattern.md) | Repository Pattern — Abstract Class, Dual Impls | ✅ Accepted |
| [ADR-008](./008-key-value-storage.md) | KeyValueStorage Abstraction | ✅ Accepted |
| [ADR-009](./009-object-mothers.md) | Object Mothers Test Pattern with @faker-js/faker | ✅ Accepted |
| [ADR-010](./010-per-context-composition.md) | Per-Context Composition Files | ⛔ Superseded by [ADR-027](./027-mobile-architecture-nestjs-sveltekit-tauri.md) (Nest modules) |
| [ADR-011](./011-implements-not-extends.md) | Abstract Classes as Interfaces (implements, not extends) | ✅ Accepted |
| [ADR-012](./012-drizzle-orm.md) | Drizzle ORM as SQLite/Postgres Abstraction | ✅ Accepted |
| [ADR-013](./013-hexagonal-architecture.md) | Hexagonal Architecture (Ports and Adapters) per Context | ✅ Accepted |
| [ADR-014](./014-ai-nutrition-analysis.md) | AI Nutrition Analysis — Google Gemini Vision Provider | ✅ Accepted |
| [ADR-015](./015-live-workout-react-island.md) | Live Workout as a Single React Island with Client Session State | ✅ Accepted (Phase 2); the React island became a Svelte screen under [ADR-027](./027-mobile-architecture-nestjs-sveltekit-tauri.md) |
| [ADR-016](./016-workout-data-model-v2.md) | Workout Data Model v2 — Workout Exercises, Set Types, RPE, Exercise-Type Metrics | ✅ Accepted (Phase 2) |
| [ADR-017](./017-exercise-catalog.md) | Exercise Catalog — System Library + Custom User Exercises | ✅ Accepted (Phase 2) |
| [ADR-018](./018-user-owned-programs.md) | User-Owned Programs and Routines (supersedes ADR-003) | ✅ Accepted (Phase 2) |
| [ADR-019](./019-rotation-scheduling-and-onboarding.md) | Rotation Scheduling and Rule-Based Program Recommendation | ✅ Accepted (Phase 2) |
| [ADR-020](./020-personal-records.md) | Personal Records — Definitions, Epley 1RM, Computed On Demand | ✅ Accepted (Phase 2) |
| [ADR-021](./021-progression-engine.md) | Progression Engine — Double Progression, Plateau, Deload | ✅ Accepted (Phase 2) |
| [ADR-022](./022-readiness-and-recovery.md) | Readiness Check-In and Muscle Recovery Model | ✅ Accepted (Phase 2) |
| [ADR-023](./023-body-metrics-privacy.md) | Body Metrics Are Owner-Only | ✅ Accepted (Phase 2) |
| [ADR-024](./024-social-interactions.md) | Social Interactions — Family Feed, Likes, Comments | ✅ Accepted (Phase 2) |
| [ADR-025](./025-offline-live-workout.md) | Offline-First Live Workout — IndexedDB Outbox, Idempotent Sync | ✅ Accepted (Phase 2), amended 2026-10-29: no service worker, outbox implemented |
| [ADR-026](./026-weekly-ai-coach-summary.md) | Weekly AI Coach Summary — Gemini Text, Facts First | ✅ Accepted (Phase 2) |
| [ADR-027](./027-mobile-architecture-nestjs-sveltekit-tauri.md) | Mobile Architecture — NestJS API, SvelteKit Static SPA, Tauri 2 | ✅ Accepted (2026-10-29) |

> ADR-015 to ADR-026 were written against the earlier Astro + Supabase stack. Their domain decisions (data model, progression, privacy, social, AI summary) stand. Where they mention islands, Astro, Supabase, RLS or a service worker, [ADR-027](./027-mobile-architecture-nestjs-sveltekit-tauri.md) supersedes the implementation detail.
