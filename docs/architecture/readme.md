# Architecture

Parent: [../README.md](../README.md)

How Gym Up is built: system shape, data flow, schemas, components, and technical constraints.

## Folder Responsibility

- `decisions/` — Architecture Decision Records (ADRs)
- `contexts/` — Feature-level architecture context

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
