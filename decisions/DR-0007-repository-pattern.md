---
id: DR-0007
title: "Repository Pattern — Abstract Class, Dual Implementations"
status: implemented
tier: 3
date: 2026-07-21
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
    - "Use cases depend only on abstract repository classes, never on a concrete implementation"
  review_by: 2027-02-04
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-007
---
# DR-0007 · Repository Pattern — Abstract Class, Dual Implementations

## Legacy status

Accepted

## Context

Each entity needs a repository. Tests and e2e need a fast, local DB without depending on Supabase. Production needs Supabase. Need both implementations to be interchangeable.

## Decision

Each entity repository is an **abstract class** (not interface, not inheritance). Two concrete implementations:

1. **Supabase** — production. Uses `@supabase/supabase-js`.
2. **SQLite** — tests and e2e. Uses `better-sqlite3` or similar.

The abstract class defines the **contract** (method signatures, return types, exceptions). Both implementations conform to it. Use cases depend on the abstract class, never on a concrete implementation.

### Pattern (Composition over Inheritance)

```ts
// Abstract class — the contract
abstract class WorkoutRepository {
  abstract create(data: WorkoutCreateDTO): Promise<Workout>;
  abstract getById(id: string): Promise<Workout | null>;
  abstract getByUserAndDate(userId: string, date: string): Promise<Workout | null>;
  abstract update(id: string, data: WorkoutUpdateDTO): Promise<Workout>;
  abstract delete(id: string): Promise<void>;
}

// Supabase implementation
class SupabaseWorkoutRepository implements WorkoutRepository {
  constructor(private supabase: SupabaseClient) {}
  async create(data) { /* supabase.from('workouts').insert(...) */ }
  // ...
}

// SQLite implementation
class SqliteWorkoutRepository implements WorkoutRepository {
  constructor(private db: Database) {}
  async create(data) { /* db.prepare('INSERT INTO workouts...').run(...) */ }
  // ...
}

// Composition root — picks the impl
const repo = config.useSupabase
  ? new SupabaseWorkoutRepository(supabaseClient)
  : new SqliteWorkoutRepository(sqliteDb);

// Use case depends on abstract class
class StartWorkoutUseCase {
  constructor(private workoutRepo: WorkoutRepository) {}
  async execute(userId, routineDayId) {
    return this.workoutRepo.create({ user_id: userId, ... });
  }
}
```

> **Note**: Per [ADR-011](./DR-0011-implements-not-extends.md), concrete classes use `implements`, not `extends`. The abstract class is a contract; concrete classes fulfill it. No inheritance chain.

## Rationale

- **Abstract class, not interface**: TypeScript interfaces can't enforce `implements` at runtime. Abstract class is a real contract with TS support + clear pattern for future languages.
- **Abstract class, not inheritance chain**: Use cases don't extend repositories. They **receive** the repository as a dependency (constructor injection). This is composition over inheritance.
- **One contract per entity**: Each entity gets its own abstract class (`WorkoutRepository`, `ProfileRepository`, etc.). Not one generic `Repository<T>`.
- **SQLite for tests**: Fast, no network, no auth, deterministic. Runs in same process as tests.
- **Supabase for production**: Already chosen per [ADR-001](./DR-0001-supabase-client-side.md). Same contract, different impl.

## Trade-offs

- **Pro**: Tests are fast and isolated. No Supabase dependency in CI.
- **Pro**: Use cases are decoupled from persistence choice.
- **Pro**: Easy to add new implementations (e.g., `InMemoryWorkoutRepository` for unit tests).
- **Con**: Two implementations to maintain. Schema changes must update both.
- **Con**: SQLite schema must mirror Supabase schema (extra effort).

## Consequences

- Every entity has an abstract `XxxRepository` class in `domain/ports/`.
- Every entity has a `SupabaseXxxRepository` and `SqliteXxxRepository` in `infrastructure/`.
- Use cases depend on the abstract class via constructor injection.
- The per-context composition file (e.g. `src/lib/contexts/<context>/<context>.composition.ts`, per [ADR-010](./DR-0010-per-context-composition.md)) wires concrete impls based on config. **No central `container.ts` or `composition-root.ts`** — each context owns its own wiring.
- Tests use `SqliteXxxRepository` with a test DB seeded per test.
- E2E tests use `SqliteXxxRepository` with a fresh DB per run.

## Referenced by

- [system.md](../docs/architecture/system.md) — composition root
- [all contexts](../docs/architecture/contexts) — repository pattern in each context

## Log

- 2026-07-21 accepted as ADR-007 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/007-repository-pattern.md; status mapped to the code as of today: implemented. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet. review_by 2027-02-04 set at migration as a placeholder deadline.
- 2026-11-04 note: Only the SQLite/D1 implementation exists today; the Supabase twin was dropped with DR-0027, so the "dual implementations" part no longer holds.
