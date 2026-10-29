# Context Architecture

Parent: [../readme.md](../readme.md) · Up: [../../README.md](../README.md)

Feature-level architecture context. One context per feature. **Hexagonal architecture (ports and adapters)** with clear layer separation. Per [ADR-013](../decisions/013-hexagonal-architecture.md).

## Folder Structure

```txt
contexts/
  auth/
    readme.md          ← Domain, Application, Infrastructure, UI
    flows/
      *.flow.md        ← End-to-end behavior flows
  user/
    readme.md
    flows/
  workout-tracking/
    readme.md
    flows/
  progress/
    readme.md
    flows/
  public-view/
    readme.md
    flows/
  private-photos/
    readme.md
    flows/
  nutrition/
    readme.md
    flows/
  exercise-library/    ← Phase 2
    readme.md
    flows/
  routines/            ← Phase 2
    readme.md
    flows/
  progression/         ← Phase 2
    readme.md
    flows/
  body-metrics/        ← Phase 2
    readme.md
    flows/
  social/              ← Phase 2
    readme.md
    flows/
```

Each context readme contains all layers (Domain, Application, Infrastructure, UI) in a single file. Flows are separate files in `flows/`. Phase 1 contexts extended in Phase 2 carry a `## Phase 2` section at the end of their readme. Code lives in `src/lib/contexts/<ctx>/{domain,application,infrastructure/{sqlite,supabase}}/` plus `<ctx>.composition.ts` ([ADR-010](../decisions/010-per-context-composition.md)).

## Contexts

| Context | Feature | Phase | Status |
|---------|---------|-------|--------|
| [auth/](./auth/) | Auth (register, login, session) | 1 | planned |
| [user/](./user/) | User profile and settings. No code folder: profile use cases live in workout-tracking ([user → Phase 2](./user/readme.md#phase-2)) | 1, 2 | planned |
| [workout-tracking/](./workout-tracking/) | [workout-tracking](../../prd/features/workout-tracking.md) | 1, 2 | planned |
| [progress/](./progress/) | [progress](../../prd/features/progress.md) | 1, 2 | planned |
| [public-view/](./public-view/) | [public-view](../../prd/features/public-view.md) | 1, 2 | planned |
| [private-photos/](./private-photos/) | [private-photos](../../prd/features/private-photos.md) | 1, 2 | planned |
| [nutrition/](./nutrition/) | [nutrition](../../prd/features/nutrition.md) | 1 | planned |
| [exercise-library/](./exercise-library/) | [exercise-library](../../prd/features/exercise-library.md) — catalog + custom exercises ([ADR-017](../decisions/017-exercise-catalog.md)) | 2 | planned |
| [routines/](./routines/) | [routines](../../prd/features/routines.md) — programs, routines, rotation, onboarding ([ADR-018](../decisions/018-user-owned-programs.md), [ADR-019](../decisions/019-rotation-scheduling-and-onboarding.md)) | 2 | planned |
| [progression/](./progression/) | [progression](../../prd/features/progression.md) — suggestions, plateaus, deloads, readiness, recovery ([ADR-021](../decisions/021-progression-engine.md), [ADR-022](../decisions/022-readiness-and-recovery.md)) | 2 | planned |
| [body-metrics/](./body-metrics/) | [body-metrics](../../prd/features/body-metrics.md) — owner-only measurements ([ADR-023](../decisions/023-body-metrics-privacy.md)) | 2 | planned |
| [social/](./social/) | [social](../../prd/features/social.md) — family feed, likes, comments, share image ([ADR-024](../decisions/024-social-interactions.md)) | 2 | planned |

## Cross-context ports (Phase 2)

A context never imports another context's repositories. When it needs another context's data or behaviour, it depends on a **port**: an abstract class declared by the providing context, implemented there, and exported as a singleton from the provider's composition root. The consumer injects that instance through its own composition root. The provider's readme is authoritative for each port's signature.

| Port | Provided by | Consumed by |
|---|---|---|
| `ExerciseCatalogPort` | [exercise-library](./exercise-library/readme.md) | workout-tracking, routines, progression, progress |
| `RoutinePlanPort` | [routines](./routines/readme.md) | workout-tracking (start a workout from a routine), progression (rep ranges) |
| `WorkoutSnapshotPort` | [workout-tracking](./workout-tracking/readme.md) | routines (save a workout as a routine, FR-RT-018) |
| `SuggestionPort` | [progression](./progression/readme.md) | workout-tracking (live workout props, deload flag on start) |
| `RecordBaselinePort` | [progress](./progress/readme.md) | workout-tracking (live PR baseline, [ADR-020 §4](../decisions/020-personal-records.md)) |
| `PrCountPort` | [progress](./progress/readme.md) | social (feed card, detail badges, share image), public-view (PRs in the last 30 days) |
| `BodyWeightPort` | [body-metrics](./body-metrics/readme.md) | progress (bodyweight volume, weekly facts), private-photos (photo comparison). Owner's own data only ([ADR-023 §4](../decisions/023-body-metrics-privacy.md)) |
| `RoutineCopyPort` | [routines](./routines/readme.md) | social (*Guardar rutina* on a sibling's workout, FR-SO-009) |
| `CoachSummaryPort` (internal) | [progress](./progress/readme.md) (Gemini adapter + template fallback) | progress only — not a cross-context port ([ADR-026](../decisions/026-weekly-ai-coach-summary.md)) |
| `ProgressionInsightsPort` | [progression](./progression/readme.md) | progress (plateaus, deload status and readiness for the weekly facts) |

Pure domain functions with no I/O (for example the e1RM formula or label maps) may be imported across contexts as a shared kernel. Use cases may also be composed across contexts at the composition root, as `public-view.composition.ts` does with progress's `CalculateStreakUseCase`.

## Layer Rules

### Domain

- Business rules, invariants, entities, value objects, ports (interfaces).
- No UI, framework, HTTP, database, or vendor details.
- Domain describes what MUST be true, not how it looks or which endpoint carries data.

### Application

- Use cases and orchestration.
- Depends on domain contracts and ports.
- Coordinates persistence, side effects through ports.
- Does NOT import concrete adapters.

### Infrastructure

- Delivery and adapter details: HTTP, endpoints, payloads, DTOs, persistence adapters.
- Implements ports defined in domain.
- Vendor payloads stay here and must not leak into domain.

### UI

- Presentation layer: components, pages, forms.
- Calls application use cases.
- No business logic here.

### Flows

- End-to-end behavior across UI, application use case, domain rule, persistence, and response.
- Every flow file uses `.flow.md` extension.
- Flow files name decisions, failure branches, and known gaps.
