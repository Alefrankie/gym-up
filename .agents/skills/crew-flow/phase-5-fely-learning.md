# Phase 5 — Fely (Learning & Self-Improvement)

**Fely's job after approval:** turn what happened this session into rules that change future decisions — and store each rule where it belongs, at the right durability.

**Golden rule of memory:**

> Do not save "things that happened." Save "rules that change future decisions."

A fact about the past (e.g. "the user said the bug was not in the mapper") is dead weight. A rule with a trigger, an action, and a reason (e.g. "before modifying the mapper, check whether the problem comes from pagination or the repository — this project had that confusion before") changes what the next agent does. Only the second kind survives.

---

## The pipeline

```
1. SESSION NOTES   raw / semi-raw record of what happened   → .crew/sessions/session.<story-#>.md (already written)
        ↓
2. REFLECTION      what went wrong, why, what rule it implies
        ↓
3. DISTILLATION    compress to one short, actionable, verifiable rule (+ dedup)
        ↓
4. PROMOTION       route by scope × stability → project CLAUDE.md / .crew/crew-learnings.md / inline-into-skill / skill crew-learnings.md
        ↓
5. RETRIEVAL       (next session) load only the relevant rules, not everything
```

Stages 1–4 run now. Stage 5 runs in Phase 0 of future sessions (documented here so the loop is closed).

---

## Stage 1 — Session notes

Already captured in `.crew/sessions/session.<story-#>.md`. No new work — this is the raw input.

## Stage 2 — Reflection

Scan every user message and Julian's Documentation Gap Capture. For each correction, instruction, preference, or gap, write a short reflection:

- **What happened** — the correction / friction / gap
- **Why** — root cause (why did the crew get it wrong, or have to ask?)
- **Rule implied** — what should change next time

Skip anything that is just an outcome with no future consequence.

### Fix Mode — Root Cause Analysis

When the session was a `fix`, run this additional lens before distillation:

**1. What introduced the bug?**
- Was it a missing test (behavior never verified)?
- A spec that was never read or was ambiguous?
- A side effect of a previous change?
- A pattern used incorrectly across the codebase?

**2. Where else does this pattern exist?**
- Did Angel's blast radius map surface other locations?
- Should Julian have fixed those too, or were they intentionally deferred?
- If deferred: create a rule to catch them in a future session.

**3. What would have prevented this?**
- A `.pattern.md` that doesn't exist yet?
- A golden rule that was absent or unclear?
- A test that should have been written when the original code was added?

**4. Root cause rule form:**
Distill findings into the trigger → action → reason form, but the trigger must be **prospective** — it fires *before* this class of bug can happen again, not after:

> ❌ "After fixing X, check Y" — reactive, fires too late
> ✅ "Before modifying X, verify Y — reason: prior bug showed Z" — preventive, fires at the right moment

This root cause pass feeds Stage 3 (Distillation) alongside the regular reflection pass. Rules from root cause analysis are treated identically — same routing, same quarantine/promote logic.

## Stage 3 — Distillation

Turn each reflection into **one** rule that is:

- **Short** — one or two sentences
- **Actionable** — has a trigger ("before X", "when Y") and an action ("verify Z", "use W")
- **Verifiable** — a future agent can tell whether it followed the rule

**Form:** `[trigger] → [action] → [reason]`.

**Dedup before keeping** — cross-reference against existing rules in golden-rules.md, project rules (CLAUDE.md / .implement-rules.md / AGENTS.md), and crew-learnings.md:

- **Already covered** → drop it (not a learning). If user said "use TDD" and Phase 3 already enforces TDD, it is not new.
- **Reinforces an existing rule** → do not duplicate; bump its `confidence` (see format below).
- **Contradicts an existing rule** → do NOT silently overwrite. Escalate to user: "New session suggests X, but rule Y says the opposite. Which wins?"
- **Genuinely new** → keep, proceed to promotion.

## Stage 4 — Promotion

Route each surviving rule along **two axes**: *whose rule is it* (scope) and *how stable is it* (quarantine vs promoted).

**Axis 1 — scope (whose rule):**

| Check                                                        | scope        |
| ------------------------------------------------------------ | ------------ |
| Specific to the project being worked on (its domain, conventions, infra)? | `project`    |
| Useful to the crew in **any** project (how the crew works)?  | `skill`      |

**Axis 2 — stability:**

| Check                              | Result                       |
| ---------------------------------- | ---------------------------- |
| User confirmed it explicitly?      | confidence +1                |
| Confirmed/used in 2+ sessions, no contradiction? | **promoted** (stable) |
| Single confirmation / dubious / contradicts an existing rule? | **quarantine** |

**Destinations (scope × stability):**

| scope     | quarantine                                  | promoted (stable)                                                        |
| --------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `project` | `.crew/crew-learnings.md` **in the project root** | the project's `CLAUDE.md` / `AGENTS.md`                            |
| `skill`   | `crew-learnings.md` **in this skill dir**   | **integrated inline** into the skill's permanent files (golden-rules.md / .implement-rules.md / the relevant phase file) |

Create `.crew/` (and `.crew/crew-learnings.md`) in the project root if missing.

### Integrating a promoted skill rule — IMPORTANT

When a skill rule graduates, **do not append a "Learnings" section anywhere.** Edit the rule into the file where that knowledge naturally belongs, written as if it had always been there:

- A rule about *how to implement* → add a bullet under the matching section of `golden-rules.md` (or `.implement-rules.md`).
- A rule about *how a phase runs* → edit that phase file's instructions directly.
- A rule like "this project uses `.flow.md` contract files" → it must appear where pattern files are first described (phase-0), not as a trailing note — so the crew reads it from the start, not after the fact.

The test: a fresh reader should not be able to tell the rule was learned later. No "Learned on <date>" headers, no separate block. Integrate, don't append.

> **AGENTS.md vs CLAUDE.md:** Claude Code reads `CLAUDE.md` natively. If the project uses `AGENTS.md` as cross-tool source of truth, write there and ensure `CLAUDE.md` points to it. Never maintain the same rule in both.

**Quarantine is not permanent storage — it has exits:**

- **Graduate:** a quarantined rule confirmed/used in **2+ later sessions** → promote (skill → integrate inline; project → CLAUDE.md/AGENTS.md) and remove the quarantine entry.
- **Decay:** a quarantined rule **not used in 5+ sessions** (stale `last-used`) → delete. Surface the deletion to user before removing.
- **Re-scope:** a `scope: skill` entry whose body is really about one project's files/contracts is misrouted → move it to that project's `.crew/crew-learnings.md`.

---

## Rule format (Distillation + Promotion output)

Every persisted rule — wherever it lands — carries frontmatter so Retrieval can load it selectively and Promotion can graduate/decay it:

```markdown
---
trigger: "before modifying the mapper"   # for retrieval matching
scope: project                           # skill | project
confidence: 2                            # times confirmed across sessions
last-used: 2026-05-31                    # for decay
status: quarantine                       # quarantine | promoted
---
Before modifying the mapper, verify whether the problem comes from
pagination or the repository. Reason: prior confusion (session #12).
```

The frontmatter is required only in quarantine files (`crew-learnings.md` or `.crew/crew-learnings.md`), where graduation/decay are tracked. Promoted rules are inlined as plain prose under the right heading — no frontmatter, no trace of when they were learned.

---

## Output format (present to user before persisting)

```
## Fely — Session Learnings

### Distilled Rules
Rules I extracted this session (trigger → action → reason):

1. [rule] — scope: [project | skill], destination: [.crew/crew-learnings.md | skill crew-learnings.md | inline into <file> | project CLAUDE.md], confidence: [..]
2. ...

### Reinforced / Contradicted
- [existing rule] — reinforced (confidence N → N+1)
- [existing rule] — CONTRADICTED by [new observation] — needs your call

### Documentation Gaps Found
Areas Julian had to ask about — consider documenting in the codebase:

1. [gap] — [file/domain context]
...

### Quarantine Hygiene (run every session, even with zero new rules)
- Graduations: [rules confirmed in 2+ sessions → integrate now, or "none"]
- Decays: [rules unused 5+ sessions → propose deletion, or "none"]
- Re-scopes: [scope: skill entries referencing one project's files/contracts → move to that project's quarantine, or "none"]

---

Persist these? Routing: project rules → `.crew/crew-learnings.md` (or the
project's CLAUDE.md when stable); skill rules → this skill's `crew-learnings.md`
(or integrated inline into the skill's permanent files when stable).
```

**Append this block to the session log (`.crew/sessions/session.<story-#>.md` in the project).**

**If no new rules found and quarantine hygiene has no actions:** Fely skips this phase silently. Do not present an empty list.

---

## Persisting

### If user says yes

- Write each rule to its Stage 4 destination (table above) — quarantine entries with full frontmatter, stable rules inlined per "Integrating a promoted skill rule".
- Bump confidence on reinforced rules; apply graduations, decays, and re-scopes decided this session.

### If user says no

- Acknowledge and move on. Do not persist.

### Quarantine file shape (`crew-learnings.md` and `.crew/crew-learnings.md`)

```markdown
# Crew Learnings (Quarantine)

Single-confirmation / dubious / temporary rules. Graduate after 2+ confirmations
(skill rules integrate inline; project rules go to CLAUDE.md/AGENTS.md); delete
after 5+ sessions unused. Stable rules do NOT live here.

---
trigger: "..."
scope: skill          # skill | project
confidence: 1
last-used: 2026-06-01
status: quarantine
---
[rule body]
```
