# Golden Rules Vault

Implementation rules enforced by the crew. Precedence: pattern files (`*.pattern.md` / `*.flow.md`) > project rules (CLAUDE.md / AGENTS.md / .implement-rules.md) > crew learnings > these golden rules.

---

## Null Policy

- `null` forbidden in domain/application layer
- Absent value → `T | undefined`
- Invalid state → `throw DomainException`

## Mutation Policy

- Aggregates mutate only through own methods — never direct property assignment from outside
- Use stage→commit pattern: `aggregate.stage(key, val, ctx)` → `aggregate.commit()`
- If project has named staging mechanism, use it

## Cross-Context Isolation

- Bounded context never directly mutates another context's aggregate
- Cross-context communication: domain events or application service calls with typed I/O contracts
- Never: service A writes to service B's repository

## Side-Effect Free Reads

- `get*`, `find*`, `calculate*`, `check*` must not write to DB or mutate persisted state
- If read requires temporary state lock → design smell, surface it

## Schema Contracts

- No untyped blobs: `saveUnknown`, `Object`, `any` forbidden in persisted schemas
- Every persisted field declared with type + constraints

## Test Fixtures

- Fixtures/mocks use current field names and shapes
- Legacy field names in fixtures = contract drift, update them (allowed without gate — keeps fixtures honest, does not change assertions)
- Never edit existing tests to make them pass — surface conflict, user decides
- **Adding** a new test: free. **Modifying / renaming / moving / deleting** an existing test: gated — declare which test, why, and what coverage changes, then wait for approval (Phase 3 Step 2d — Test Modification Protocol)
- Before changing any user-visible string constant used in components, `grep -r "old string" tests/` across ALL test subdirectories (unit AND integration) — both layers may assert the old value; missing one causes a failing run that looks like a new regression

## Test Coverage

- Unit tests (Vitest or project equivalent) for logic
- When the change requires UI functional validation, add Playwright browser tests alongside the unit tests — unit tests alone do not prove UI behavior

## DDD

- Aggregates enforce invariants — one transaction boundary per aggregate
- Value objects are immutable, compared by value
- Entities compared by identity, not attributes
- Domain events are past-tense, immutable, carry only what consumers need
- Repositories return aggregates or throw — never return null/undefined for "not found" (use `find*` returning `T | undefined`, `get*` throwing)
- Application services orchestrate — no business logic in services
- Anti-corruption layers at context boundaries — translate external models before they enter

## SOLID

- **SRP:** One reason to change per class/module. If you need two adjectives to describe what it does, split it.
- **OCP:** Extend via new code, not modification. Use interfaces/abstractions for extension points.
- **LSP:** Subtypes must be substitutable. If a subtype throws `UnsupportedOperation`, the hierarchy is wrong.
- **ISP:** Many small interfaces > one fat interface. Clients depend only on what they use.
- **DIP:** High-level modules depend on abstractions, not concretions. Inject dependencies, don't instantiate them internally.

## Naming

- Methods: verb + noun (`calculateTotal`, `findUser`, `validateEmail`)
- Booleans: `is*`, `has*`, `can*`, `should*`
- Collections: plural nouns (`users`, `orderItems`)
- Domain events: past tense (`OrderPlaced`, `PaymentFailed`)
- No abbreviations in public API — clarity > brevity

## Error Handling

- Domain errors → typed exceptions (`OrderAlreadyShippedError`)
- Infrastructure errors → wrap in domain exception with context
- Never swallow errors silently — log or rethrow
- Error messages include: what happened, what was expected, what to do

## API Design

- Input validation at boundary — reject early with clear messages
- Return types express all outcomes — no surprise exceptions paths
- Idempotency for write operations where possible
- Version APIs from day one

## Best Practices

- Two valid approaches found for same problem → stop, present both to user with tradeoffs, user decides (exception: conditionals — Phase 3 Step 2c: a cleaner non-`if` alternative wins without prompting)
- Exception: trivial choice (naming a variable, obvious one-liner) → pick best approach, never worst or easiest
- "Best" = most readable, most maintainable, most aligned with existing codebase conventions
- "Easiest" ≠ "best" — shortcuts that skip error handling, testing, or contracts are never acceptable
- When in doubt about approach quality → ask, don't guess
- Before editing a config/dictionary/registry file: **verify it is actually imported somewhere.** A file with correct entries that nothing imports has zero effect in production. Check for import references before assuming changes will propagate.
- When a local/demo implementation stands in for missing production infrastructure: **explicitly document the production gap** in story evidence and manual notes. Future rounds must not mistake demo persistence for production readiness.
- Before implementing production repository adapters (Drizzle, Prisma, direct SQL), create an in-memory implementation first. Reason: tests must run without infrastructure dependencies; in-memory adapters keep port/adapter pattern honest and enable fast TDD without DB setup.
- Before treating a lint/test failure as a regression introduced by your change, confirm it also fails identically on a file your change did not touch. If so, it is environmental (e.g. a tool/plugin version mismatch), not code-introduced — note it and move on, don't block the session on it.
- Before running an autoformatter or linter with an auto-fix flag (`--write`, `--fix`) always scope it to the exact list of files changed in the current diff — never a directory glob. A valid config file does not protect against a brownfield repo's backlog of pre-existing unformatted files; pointing `--write` at a directory will "fix" all of it, producing a diff hundreds of files larger than the actual change.

## QA-First Thinking

Every implementation must be built to pass QA on the first attempt. This is not aspirational — it is a design constraint.

- **Write the QA test before the implementation.** Not just the TDD unit test — think about what Fely will check. If Fely would test "set value → navigate → return → verify persistence," write that test too.
- **User-owned fields are sacred.** Never overwrite a field the user explicitly set without checking ownership first. The `USER_PROTECTED_KEYS` list + `forceProtectedWrite` conditional pattern is the canonical guard.
- **Error paths are not optional.** Every `set({ status: 'loading' })` must have a `catch` that sets `status: 'error'`. Every API call must have user-facing error handling.
- **Test the combination, not just the individual.** If the code touches a feature that interacts with another feature, write at least one test that exercises both.
- **The UI is the contract.** Missing tooltips, missing error toasts, missing badges = incomplete implementation, not polish. These are what UAT catches.
- **Build before declaring done.** `tsc --noEmit` or the project's real build must pass. Vitest green is necessary but not sufficient.
