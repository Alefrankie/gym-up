---
id: ADR-007
title: Repository Pattern — Abstract Class, Dual Implementations
type: decision
status: accepted
date: 2026-07-21
---

# ADR-007: Repository Pattern — Abstract Class, Dual Implementations

## Status

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

> **Note**: Per [ADR-011](./011-implements-not-extends.md), concrete classes use `implements`, not `extends`. The abstract class is a contract; concrete classes fulfill it. No inheritance chain.

## Rationale

- **Abstract class, not interface**: TypeScript interfaces can't enforce `implements` at runtime. Abstract class is a real contract with TS support + clear pattern for future languages.
- **Abstract class, not inheritance chain**: Use cases don't extend repositories. They **receive** the repository as a dependency (constructor injection). This is composition over inheritance.
- **One contract per entity**: Each entity gets its own abstract class (`WorkoutRepository`, `ProfileRepository`, etc.). Not one generic `Repository<T>`.
- **SQLite for tests**: Fast, no network, no auth, deterministic. Runs in same process as tests.
- **Supabase for production**: Already chosen per [ADR-001](./001-supabase-client-side.md). Same contract, different impl.

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
- Composition root (`src/lib/composition/container.ts`) wires concrete impls based on config.
- Tests use `SqliteXxxRepository` with a test DB seeded per test.
- E2E tests use `SqliteXxxRepository` with a fresh DB per run.

## Referenced by

- [system.md](../system.md) — composition root
- [all contexts](../contexts/) — repository pattern in each context
