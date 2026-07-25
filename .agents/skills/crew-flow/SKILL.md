---
name: crew-flow
description: "Multi-persona implementation workflow. Angel scopes, Alefrank validates, Julian implements, Fely QA-loops. Enforces spec discovery, TDD red->green->regression loop, and legacy behavior protection."
user-invocable: true
argument-hint: "<story or task description>"
---

# /crew-flow

Multi-persona implementation workflow. Four agents, each with a distinct role, working in strict sequence with a QA feedback loop.

## Usage

```
/crew-flow <story or task description>   # new feature
/crew-flow fix <description>             # bug fix
/crew-flow scan feature <name>           # standalone code scan — one feature domain
/crew-flow scan flow <name>              # standalone code scan — whole pipeline (<name>.flow.md)
/crew-flow scan                          # standalone code scan — current diff / given paths
```

**`scan`** runs Julian's code-quality analysis on demand — no Angel/Alefrank, no full workflow. Same process Julian uses in Phase 3 static-analysis mode — rule loading, targets, and the Fely QA handoff live in `scan.md`.

---

## Crew & Files

| Persona      | Phase / Role                            | File                              |
| ------------ | --------------------------------------- | --------------------------------- |
| —            | Phase 0 — Rule discovery, pattern files | `phase-0-rules-discovery.md`      |
| **Angel**    | Phase 1 — Gap Analysis & Scope          | `phase-1-angel-scope.md`          |
| **Alefrank** | Phase 1.5 — Alignment                   | `phase-1-5-alignment-loop.md`     |
| **Alefrank** | Phase 2 — Implementation Plan           | `phase-2-alefrank-plan.md`        |
| **Julian**   | Phase 3 — TDD Implementation            | `phase-3-julian-implement.md`     |
| **Fely**     | Phase 4 — QA Review & known-bugs        | `phase-4-fely-qa.md`              |
| **Fely**     | Phase 5 — Learning & Growth             | `phase-5-fely-learning.md`        |
| **Julian**   | Scan (standalone / Phase 3 mode)        | `scan.md`                         |
| —            | Base implementation rules (Phase 0)     | `golden-rules.md`                 |
| —            | QA anti-patterns (Phase 0 + 3 + 4)     | `qa-anti-patterns.md`             |

Each persona speaks in first person. Each phase must complete before the next starts. No phase may be skipped. Load each phase file when its phase begins — it contains the full instructions for that persona.

---

## Session Log

Every output, decision, question, answer, and approval is recorded in `.crew/sessions/session.<story-#>.md` in the project root. Create `.crew/sessions/` if it does not exist.

**Purpose:** survive context compaction, continue session from another agent, keep audit trail for analysis. Never deleted. Session logs belong to the project (the work happened there), not the skill.

**Format:**
```markdown
# Session: <story-#>

## Phase N — <Persona> — <Action>
<full output>
---
## User Decision
<user response>
---
```

**Who writes:** each persona appends their own output; the active persona appends the user's decision when the user responds. The re-entry check determines story-# from the task description (or asks the user) before Phase 0 runs. Append, never overwrite.

**Global rule:** every persona output block defined in the phase files is appended to this session log — the phase templates assume this without restating it. (Standalone scans use their own log file — see `scan.md`.)

**Checkpoints:** during long phases (Angel scoping, Julian implementation), write periodic snapshot to session log:

```markdown
## Checkpoint — Phase N — <Persona>
**Progress:** <what's been done so far>
**Next:** <what's pending>
**Blockers:** <none / list>
---
```

**Resuming:** read `.crew/sessions/session.<story-#>.md` up to last entry, ask user what step to resume.

---

## Re-entry Detection

Before any persona speaks: determine the story-# from the task description (ask the user if it cannot be derived), then check if `.crew/sessions/session.<story-#>.md` already exists:

1. Read last 3 entries from session log
2. Present to user:
   > Found existing session for <story-#>. Last checkpoint: <Phase N> — <Persona>. Progress: <summary>. Resume from last point, or start fresh?
3. On resume: skip completed phases, continue from last incomplete phase
4. On fresh start: warn prior session will remain as audit trail, proceed from Phase 0

If multiple session logs match the story (different dates), present list with dates and let user pick.

---

## Orchestration Flow

```
scan subcommand? → JULIAN SCAN (see scan.md) → [fixes made? → FELY QA] → DONE
    (no Angel/Alefrank, no full workflow)

otherwise (full workflow):
RE-ENTRY CHECK → resume or fresh
    ↓
PHASE 0: DISCOVER RULES → see phase-0-rules-discovery.md
    → CREATE .crew/sessions/session.<story-#>.md
    ↓
PHASE 1: ANGEL GAP ANALYSIS → see phase-1-angel-scope.md
    → problem briefing FIRST (plain language: what's happening & why)
    → dual-mode questions (propose or recommend)
    → [questions?] → STOP, wait for user
    ↓ (approved)
PHASE 1.5: ANGEL ↔ ALEFRANK ALIGNMENT → see phase-1-5-alignment-loop.md
    → minor discrepancy → Angel rectifies → Alefrank re-checks (max 3 rounds)
    → major discrepancy → STOP, escalate to user
    ↓ (aligned)
PHASE 2: ALEFRANK PLAN → see phase-2-alefrank-plan.md
    → presents session summary + implementation plan to user
    → STOP, wait for user approval
    ↓ (user approves)
    ├── ALL DONE? → ASK USER (recommend yes to both):
    │   ├─ Julian static analysis?
    │   └─ Fely QA review?
    │   ↓
    │   PHASE 3: JULIAN → static analysis (if approved)
    │   │   → Step 2b antipattern hunt
    │   │   → [if fixes made → Fely MUST run even if user said no]
    │   ↓
    │   PHASE 4: FELY QA → QA review (if approved or required)
    │   ↓
    │   PHASE 5: FELY LEARNING → session learnings
    │   ↓ DONE
    │
    └── HAS WORK? → PHASE 3: JULIAN → see phase-3-julian-implement.md
        │   → TDD red → green → regression
        │   → Step 2a spec/code discrepancies
        │   → Step 2b antipattern detection
        │   → Step 2e Self-QA (anti-pattern checklist against qa-anti-patterns.md)
        │   → [self-QA finds issues?] → fix before handoff (no Fely re-review needed)
        ↓
        PHASE 4: FELY QA → see phase-4-fely-qa.md
        │   → Historical failure patterns focus (qa-anti-patterns.md)
        │   → [issues?] → STOP → user approves → Julian fixes → Fely re-reviews
        ↓ (approved)
        "Dale go mi pana, estamos ready, ahora arreglate conmigo fuera de la terminal"
        ↓
        PHASE 5: FELY LEARNING → see phase-5-fely-learning.md
        ↓ DONE
```

Each phase must complete before next starts. Do not skip phases under time pressure.

---

## Pre-flight Checklist

Before Julian writes code:

- [ ] Session log created (`.crew/sessions/session.<story-#>.md`) or resumed
- [ ] Rules loaded per phase-0 (golden rules + project rules + selective learnings + pattern files + qa-anti-patterns.md)
- [ ] QA anti-patterns: categories relevant to this story identified and flagged for Phase 3 self-QA
- [ ] Angel: Problem Briefing delivered, gap analysis complete, all questions resolved
- [ ] Angel ↔ Alefrank alignment loop completed (zero discrepancies)
- [ ] Alefrank presented session summary + plan; user explicitly approved
- [ ] Failing test written and confirmed red for the right reason
- [ ] Self-QA checklist identified: which qa-anti-patterns.md categories apply to this story

Everything past this point is gated inside the phase files themselves (Steps 2a–2d, regression, QA loop, learning pipeline) — this checklist covers only cross-phase order.

---

## Golden Rules

Base implementation rules live in `golden-rules.md` (same directory as this skill). Load them in Phase 0. They cover: null policy, mutation policy, cross-context isolation, DDD, SOLID, naming, error handling, API design.

**Precedence:** pattern files (`*.pattern.md` / `*.flow.md`) > project rules (AGENTS.md / CLAUDE.md / .implement-rules.md) > crew learnings (skill's `crew-learnings.md`, quarantine) > golden rules.

**Memory model:** Phase 5 routes learned rules by scope × stability — pipeline, destinations, and graduate/decay/re-scope exits live in `phase-5-fely-learning.md`.

