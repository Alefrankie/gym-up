---
id: DR-0013
title: "Hexagonal Architecture (Ports and Adapters) per Context"
status: implemented
tier: 3
date: 2026-07-26
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: system
reversibility: costly
risk_flags: []

depends_on: []
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/api/src/lib/contexts/"
  issues: []
  prs: []

validation:
  criteria:
    - "Each context has domain/, application/ and infrastructure/ layers"
    - "Domain code imports no infrastructure code"
  review_by: 2027-02-04
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-013
---
# DR-0013 · Hexagonal Architecture (Ports and Adapters) per Context

## Legacy status

Accepted

## Context

The codebase needs an architectural pattern that:
- Keeps business logic isolated from UI and infrastructure.
- Allows swapping storage backends (SQLite ↔ Supabase) without touching business rules.
- Scales cleanly per feature without creating a monolithic wiring file.
- Makes testing straightforward with real implementations, not mocks.

Per-context organization (ADR-010) handles isolation. The question is: what goes INSIDE each context?

## Decision

Each context follows **hexagonal architecture** (also known as **ports and adapters**):

```mermaid
graph LR
    subgraph "Domain Layer"
        E[Entities / Value Objects]
        P[Ports - abstract classes]
    end
    subgraph "Application Layer"
        UC[Use Cases / Orchestration]
    end
    subgraph "Infrastructure Layer"
        A1[SQLite Adapter]
        A2[Supabase Adapter]
        A3[AI Provider Adapter]
    end
    subgraph "UI Layer"
        C[Components / Pages]
    end

    UC --> P
    A1 --> P
    A2 --> P
    A3 --> P
    C --> UC
```

### Layers

| Layer | Responsibility | Depends on |
|-------|---------------|------------|
| **Domain** | Business rules, entities, value objects, ports (abstract classes) | Nothing (dependency root) |
| **Application** | Use cases, orchestration. Coordinates domain and ports. | Domain only |
| **Infrastructure** | Concrete adapters. Implements domain ports. | Domain (implements ports) |
| **UI** | Components, pages, forms. User interaction. | Application (calls use cases) |

### Dependency Rule

Dependencies flow **inward** toward Domain:

```
UI → Application → Domain ← Infrastructure
```

- Domain **never** imports from Application, Infrastructure, or UI.
- Application **only** imports Domain types and ports.
- Infrastructure **implements** Domain ports (via `implements`, not `extends` per ADR-011).
- UI **calls** Application use cases. No business logic in UI.

### Ports and Adapters

- **Port**: an abstract class in `domain/ports/` defining a contract (e.g., `WorkoutRepository`, `AuthPort`).
- **Adapter**: a concrete class in `infrastructure/` that implements a port (e.g., `SqliteWorkoutRepository`, `SupabaseAuthAdapter`).
- **Composition**: a per-context file (`[context].composition.ts`) that wires the correct adapter based on `STORAGE_BACKEND`. Per ADR-010.

### File Structure per Context

```
src/lib/contexts/<context>/
  <context>.composition.ts        ← wires adapters (the single place for this context)
  domain/
    <context>.types.ts            ← TypeScript interfaces
    <context>.constants.ts        ← enums, rules, constraints
    entities/                     ← domain objects with identity
    ports/                        ← abstract classes (contracts)
  application/
    *.use-case.ts                 ← one file per use case
  infrastructure/
    sqlite/                       ← SQLite adapters (D1 in production, in-memory SQLite in tests)
    [ai|storage|...]/             ← other adapter categories as needed
  ui/
    *.svelte                     ← context-specific components (in apps/app since ADR-027)
```

## Rationale

- **Isolation**: each context is a self-contained module. Changes in one context don't ripple.
- **Testability**: use cases are tested with SQLite adapters (real SQL, no network). No mocks needed (ADR-009).
- **Swappability**: storage backend changes only affect `infrastructure/` and `composition.ts`. Domain and Application untouched.
- **Scalability**: new features add a new context folder. No central container grows unbounded.
- **Clarity**: anyone reading the codebase sees the pattern at a glance — domain at the center, adapters at the edge.

## Trade-offs

- **Pro**: business logic is portable across any storage backend.
- **Pro**: tests run fast against SQLite with real implementations.
- **Pro**: new adapters (e.g., in-memory for unit tests) are trivial to add.
- **Con**: more boilerplate per context (abstract class + two implementations).
- **Con**: schema changes must update both SQLite and Supabase adapters.

## Consequences

- Every context follows the 4-layer structure: Domain → Application → Infrastructure → UI.
- Domain ports are **abstract classes** (not interfaces, per ADR-007).
- Concrete adapters use **`implements`** (not `extends`, per ADR-011).
- Per-context composition files wire adapters based on `STORAGE_BACKEND` (per ADR-010).
- Tests use SQLite adapters + Object Mothers (per ADR-009). No mocks.
- This ADR is the single source of truth for the architectural pattern. All context readmes reference it.

## Related ADRs

- [ADR-007](./DR-0007-repository-pattern.md) — Repository pattern (abstract class + dual impls)
- [ADR-008](./DR-0008-key-value-storage.md) — KeyValueStorage abstraction
- [ADR-010](./DR-0010-per-context-composition.md) — Per-context composition files
- [ADR-011](./DR-0011-implements-not-extends.md) — `implements` not `extends`
- [ADR-012](./DR-0012-drizzle-orm.md) — Drizzle ORM as SQLite/Postgres abstraction

## Log

- 2026-07-26 accepted as ADR-013 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/013-hexagonal-architecture.md; status mapped to the code as of today: implemented. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet. review_by 2027-02-04 set at migration as a placeholder deadline.
