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
```

Each context readme contains all layers (Domain, Application, Infrastructure, UI) in a single file. Flows are separate files in `flows/`.

## Contexts

| Context | Feature | Status |
|---------|---------|--------|
| [auth/](./auth/) | Auth (register, login, session) | planned |
| [user/](./user/) | User profile management | planned |
| [workout-tracking/](./workout-tracking/) | [workout-tracking](../../prd/features/workout-tracking.md) | planned |
| [progress/](./progress/) | [progress](../../prd/features/progress.md) | planned |
| [public-view/](./public-view/) | [public-view](../../prd/features/public-view.md) | planned |
| [private-photos/](./private-photos/) | [private-photos](../../prd/features/private-photos.md) | planned |
| [nutrition/](./nutrition/) | [nutrition](../../prd/features/nutrition.md) | planned |

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
