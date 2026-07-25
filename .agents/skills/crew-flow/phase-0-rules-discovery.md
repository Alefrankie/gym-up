# Phase 0 — Project Rule Discovery

Load project-specific overrides in order:

1. `golden-rules.md` in this skill's directory — base implementation rules (DDD, SOLID, patterns)
2. `qa-anti-patterns.md` in this skill's directory — historical QA/UAT failure patterns (Sprint 2–6 data). Load the full file — every category is relevant as context; specific checks apply per-story based on what the story touches
3. `AGENTS.md` / `CLAUDE.md` in project root — stable, promoted project rules. Look for: `## Implementation Rules`, `## Patterns`, `## Architecture`
3. `.implement-rules.md` in project root — dedicated overrides file
4. **Quarantine learnings** — `crew-learnings.md` (skill, `scope: skill`) and `.crew/crew-learnings.md` (project, `scope: project`). **Retrieve selectively** (see below)
5. `*.pattern.md` and `*.flow.md` files in project docs — feature/fix pattern contracts (see below)
6. Relevant spec files for the feature (PRDs, architecture docs, ADRs, test plans)

**Precedence:** pattern files > project rules (AGENTS.md/CLAUDE.md) > crew learnings > golden rules.

## Retrieval — selective load of quarantine learnings (Stage 5 of the Phase 5 memory pipeline)

Do not load every quarantined rule blindly. Entries carry frontmatter (`trigger`, `scope`, `last-used`). Load a rule only when relevant:

- **Always load** `scope: skill` rules from the skill's `crew-learnings.md` — they apply to any project.
- **Match by `trigger`** for `scope: project` rules in the project's `.crew/crew-learnings.md` — keyword overlap between the rule's trigger and the story/task description or domain. A "before modifying the mapper" rule loads only when the task touches the mapper.
- **Skip** rules whose trigger does not match this task.
- **Stamp `last-used`** — when a loaded rule actually influences this session, note it so Phase 5 can refresh its `last-used` (prevents wrongful decay).
- **Flag misroutes** — a `scope: skill` entry whose body is really about one project's files/contracts is misrouted; note it for Phase 5 re-scope.

This keeps Phase 0 cheap as the learning store grows. Stable rules already live in golden-rules.md (skill) and AGENTS.md/CLAUDE.md (project) and are always read (steps 1–2).

## Pattern files (`*.pattern.md`, `*.flow.md`)

Project-level contracts describing how a feature or fix must look. Named by domain: `restore.pattern.md`, `auth.pattern.md`, `payment.pattern.md`, etc. Projects may use `*.flow.md` files instead of or alongside `*.pattern.md` for contract specs.

**Only read patterns relevant to the current task domain.** Match by keyword overlap between the story/task description and the pattern filename. Do not load all patterns — a subscription search task does not need the report pattern.

- **New feature:** the relevant `.pattern.md` or `.flow.md` defines the expected structure, contracts, and invariants the implementation must follow
- **Fix:** the relevant `.pattern.md` or `.flow.md` defines how the corrected behavior must look — preserving legacy contracts and avoiding regressions
- **No relevant `.pattern.md` or `.flow.md` found:** infer patterns from existing code — follow established conventions, naming, structure, and contracts already in the codebase

Pattern files are authoritative. If a pattern says "X must behave like Y", Julian implements Y and Fely validates against Y.

## QA Anti-Patterns identification

After loading `qa-anti-patterns.md`, identify which categories are relevant to this story based on what it touches:

| Story touches | Relevant anti-pattern categories |
|--------------|--------------------------------|
| User-editable parameters | 1 (Silent Value Reversion), 3 (State Persistence) |
| ECM/measure logic | 2 (Calculation Logic), 8 (Cross-Feature Interaction) |
| Zone Matrix | 1, 3, 8 (highest-risk feature) |
| Package calculations | 2, 5 (Cascade), 8 |
| UI components | 4 (Affordances), 3 |
| DynamoDB entities | 5 (Cascade/Orphan) |
| External API calls | 6 (Error Paths) |
| Migration scripts | 7 (Migration) |
| Function signatures | 9 (Type-Safety) |
| Any code change | 6 (Error Paths — always check) |

Flag the relevant categories in the session log. Julian will run self-QA checks from these categories in Phase 3 Step 2e.
