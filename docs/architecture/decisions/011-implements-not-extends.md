---
id: ADR-011
title: Abstract Classes as Interfaces (implements, not extends)
type: decision
status: accepted
date: 2026-07-21
---

# ADR-011: Abstract Classes as Interfaces (implements, not extends)

## Status

Accepted

## Context

Per [ADR-007](./007-repository-pattern.md), each entity has an abstract class defining the contract. Concretely, TypeScript supports two patterns:

1. **`extends`**: `class SqliteAuthAdapter extends AuthPort` — inherits from abstract class
2. **`implements`**: `class SqliteAuthAdapter implements AuthPort` — implements the contract

`extends` creates a parent-child relationship. `implements` treats the abstract class as a pure contract (interface).

## Decision

Use `implements`, not `extends`. Abstract classes define the contract; concrete classes implement it. No inheritance chain.

### Pattern

```ts
// Contract (abstract class)
abstract class AuthPort {
  abstract signUp(data: RegisterDTO): Promise<Session>;
  abstract signIn(data: LoginDTO): Promise<Session>;
  abstract signOut(): Promise<void>;
}

// Supabase implementation
class SupabaseAuthAdapter implements AuthPort {
  constructor(private supabase: SupabaseClient) {}

  async signUp(data: RegisterDTO): Promise<Session> {
    // implementation
  }
  async signIn(data: LoginDTO): Promise<Session> {
    // implementation
  }
  async signOut(): Promise<void> {
    // implementation
  }
}

// SQLite implementation
class SqliteAuthAdapter implements AuthPort {
  constructor(private db: Database) {}

  async signUp(data: RegisterDTO): Promise<Session> {
    // implementation
  }
  async signIn(data: LoginDTO): Promise<Session> {
    // implementation
  }
  async signOut(): Promise<void> {
    // implementation
  }
}
```

## Rationale

- **No inheritance chain**: adapters don't inherit implementation, they implement contract.
- **Clearer contract boundary**: `implements` makes it explicit this is a contract, not a base class.
- **Easier to swap**: any class can implement any abstract class without joining a hierarchy.
- **TypeScript enforces**: missing methods cause compile error.
- **Composition over inheritance**: aligns with hexagonal architecture principles.
- **Multiple interfaces**: a class can implement multiple abstract classes if needed (TypeScript allows this for interfaces; abstract classes have the same flexibility).

### Why abstract class, not interface?

Per [ADR-007](./007-repository-pattern.md), we use **abstract class** over interface because:
- TypeScript interfaces don't enforce implementation at runtime.
- Abstract class is a real contract with TS support + clear pattern.
- Can hold default implementations if needed (future flexibility).

The decision here is to use abstract class as the **contract type**, but concrete classes use `implements` to fulfill it. This gives the best of both worlds:
- Strong contract enforcement (abstract class)
- No inheritance (implements)
- Same syntax as interfaces from consumer perspective

## Trade-offs

- **Pro**: No inheritance chain. Clear contract.
- **Pro**: Abstract class can be used as a TYPE (like interface).
- **Pro**: Composition over inheritance. Hexagonal purity.
- **Con**: Slightly more verbose (must `implements` explicitly).
- **Con**: If abstract class has default methods, they're not inherited (must redefine or use composition).

## Consequences

- All infrastructure classes use `implements AbstractClass`, not `extends AbstractClass`.
- All composition files unchanged — they receive the abstract class as a type.
- All use case code unchanged — depends on abstract class type.
- Linter rule: warn on `extends` for adapter/repository classes.

## Referenced by

- [ADR-007](./007-repository-pattern.md) — Repository pattern
- [ADR-008](./008-key-value-storage.md) — KeyValueStorage
- [ADR-009](./009-object-mothers.md) — Test pattern
- [ADR-010](./010-per-context-composition.md) — Per-context composition
- All context `readme.md` files
