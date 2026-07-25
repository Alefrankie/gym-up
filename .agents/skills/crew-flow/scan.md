# Scan — Standalone Code Analysis (Julian)

**Owner:** Julian. **Reusable:** invoked two ways —

1. **Standalone** — `/crew-flow scan <flow|feature> [name]`. No Angel/Alefrank, no full workflow. Quick code-quality sweep on demand.
2. **Inside Phase 3** — when Angel's gap analysis shows every task/AC `DONE` (nothing to implement), Julian runs this same scan as "static analysis mode".

Both paths run the identical process below. Phase 3 just calls into this file — do not duplicate the logic there.

---

## Targets

| Invocation | Scope | File set |
| ---------- | ----- | -------- |
| `scan feature <name>` | one feature domain | every file in that domain (dir/module that owns the feature) |
| `scan flow <name>` | a whole pipeline | every file along the flow defined by `<name>.flow.md` — cross-feature, broader |
| `scan` (bare) or `scan <path\|glob>` | ad-hoc | current diff (`git diff`/staged), or the given paths/globs |

**Resolve the target set first.** State it explicitly to the user before walking:

> Scan target: `<feature\|flow\|diff>` → N files: [list]. Proceeding.

If the name is ambiguous (no matching domain/`.flow.md`), ask which files to scan. Do not guess a broad set.

---

## Rule loading (standalone only)

Standalone scan skips Angel/Alefrank but **still loads rules** — run Phase 0 retrieval first (see `phase-0-rules-discovery.md`):

- `golden-rules.md` (skill base rules)
- project rules (`AGENTS.md` / `CLAUDE.md` / `.implement-rules.md`)
- quarantine learnings matching the target's trigger/domain
- relevant `*.pattern.md` / `*.flow.md` for the target

When invoked from Phase 3, rules are already loaded — skip reload.

**Session log:** standalone scans append to `.crew/sessions/session.scan.<target>.md` (no story-#). Phase-3 scans append to the active `session.<story-#>.md`.

---

## Process

1. Resolve and announce the target file set (above).
2. Walk every file in scope.
3. Apply golden rules + the **Step 2b** smell checklist systematically across the whole target (not just code being changed). See `phase-3-julian-implement.md` Step 2b for the full enumeration and the dual-mode finding prompt — scan reuses both verbatim. Difference: scan walks the whole target proactively; Step 2b fires opportunistically while implementing.
4. **Log every finding to `known-bugs.md`** regardless of whether the user fixes it.
5. **If the scan modifies any test:** the Test Modification Protocol applies (see `phase-3-julian-implement.md` Step 2d) — declare intention, wait for approval.

---

## After scan

- **If Julian fixed anything** (code or test): Fely **must** run QA — any change deserves validation. Standalone scan that produced fixes hands off to `phase-4-fely-qa.md`.
- **If scan was read-only** (findings logged, nothing changed): no QA needed. Report and stop.

## Output format

```
## Julian — Scan

### Target
<feature|flow|diff> — N files: [list]

### Findings
| # | file:line | Smell | Severity | Disposition |
|---|-----------|-------|----------|-------------|
| 1 | a.ts:42  | god object | high | fixed / logged-to-known-bugs / deferred |

### Changes Made
- [files changed, or "none — read-only scan"]

### Status
- Fixes made → handing off to Fely for QA.
- Read-only → scan complete, N findings logged to known-bugs.md.
```

**Append this to the session log.**
