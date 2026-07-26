# Architecture

Parent: [../README.md](../README.md)

How Gym Up is built: system shape, data flow, schemas, components, and technical constraints.

## Pattern: Hexagonal Architecture per Context

Gym Up uses **hexagonal architecture (ports and adapters)** organized **per feature context**. Each context is a self-contained module with four layers:

| Layer | Responsibility | Lives in |
|-------|---------------|----------|
| **Domain** | Business rules, entities, value objects, ports (abstract classes) | `contexts/<name>/domain/` |
| **Application** | Use cases and orchestration. Depends only on domain ports. | `contexts/<name>/application/` |
| **Infrastructure** | Concrete adapters (SQLite, Supabase). Implements domain ports. | `contexts/<name>/infrastructure/` |
| **UI** | Components, pages, forms. Calls use cases. No business logic. | `contexts/<name>/ui/` |

**Dependency rule:** Domain never depends on Application, Infrastructure, or UI. Application depends only on Domain. Infrastructure implements Domain ports. UI calls Application use cases.

Per-context composition files (`[context].composition.ts`) wire concrete adapters based on `STORAGE_BACKEND`. No central container. See [ADR-010](./decisions/010-per-context-composition.md).

→ Full layer rules: [contexts/readme.md](./contexts/readme.md)
→ Repository pattern: [ADR-007](./decisions/007-repository-pattern.md)
→ Architecture overview: [ADR-013](./decisions/013-hexagonal-architecture.md)

## Folder Responsibility

- `decisions/` — Architecture Decision Records (ADRs)
- `contexts/` — Feature-level architecture context (hexagonal, per feature)

## Files

| Path | Purpose |
|------|---------|
| [system.md](./system.md) | Topology, rendering strategy, stack, project structure |
| [database-schema.md](./database-schema.md) | PostgreSQL DDL, seed data, RLS policies |
| [components.md](./components.md) | UI component specs |
| [decisions/readme.md](./decisions/readme.md) | ADR index |
| [contexts/readme.md](./contexts/readme.md) | Context specs by feature |

## Rules

- Keep product intent in [../prd/](../prd/).
- Keep phases, limits, open questions in [../planning/](../planning/).
- Architecture docs may link to planning constraints, but committed technical design belongs here.
