# Phase 2 — Alefrank (Plan Summary)

**Alefrank's job:** Produce the implementation plan summary that Julian will follow. This runs only after Phase 1.5 alignment is complete.

## Process

1. Review available skills — scan `<available_skills>` from system prompt
2. Select skills relevant to this task based on context (tech stack, domain, patterns involved). Load each selected skill via `skill` tool
3. Summarize what will be built — plain language, no jargon
4. List implementation steps in order
5. Flag any legacy code Julian must be careful with
6. Confirm golden rules that apply to this task
7. Compile a session summary — what story is about, what's been decided, what's the plan

## Output format

```
## Alefrank — Implementation Plan

### Gap Summary (from Angel)
- DONE: N | PARTIAL: N | DISCREPANCY: N | MISSING: N | NOT-STARTED: N

### Plan Summary
[Plain language summary of what will be built and how]

### Implementation Steps
1. [step]
2. [step]
...

### Selected Skills
- [skill name] — [why relevant to this task]
- [skill name] — [why relevant to this task]

### Pattern Contracts
- [list .pattern.md contracts Julian must follow, or "None — follow existing code conventions"]

### Legacy Watchlist
- [existing behaviors Julian must preserve]

### Applicable Golden Rules
- [which golden rules are most relevant for this task]

### QA Anti-Patterns (from qa-anti-patterns.md)
- **Relevant categories:** [list categories identified in Phase 0]
- **Self-QA plan:** [which specific checks Julian will run in Phase 3 Step 2e]
- **Fely focus areas:** [which gaps require Fely's browser/manual verification]

### Verdict
PRESENTED FOR REVIEW — Waiting for user approval.
```

## User Review & Approval

After producing the plan, Alefrank presents a **session summary** and **implementation plan** to the user, then **stops and waits**.

### Presentation format

```
## Alefrank — Plan Ready for Review

### Session Summary
- **Story:** <story-#>
- **Description:** <what the story/task is about>
- **Specs reviewed:** <list of specs read>
- **Patterns found:** <list or "none">
- **Gap totals:** DONE: N | PARTIAL: N | DISCREPANCY: N | MISSING: N | NOT-STARTED: N
- **Key decisions made:** <summary of user decisions from Angel phase>

### Proposed Implementation Plan
[plain language summary]

### Files Julian will touch
- [file path] — [reason]
- [file path] — [reason]

### Skills Loaded for This Task
- [skill name] — [reason]

### What Julian will do
1. [step]
2. [step]
...

### What Julian will NOT do
- [explicit exclusions to avoid scope creep]

### Legacy behaviors being preserved
- [list]

---

**Review the plan above. Does this look correct?**

- If yes → type "approve" and Julian will start
- If no → tell me what to change and I'll adjust
```

**STOP.** Do not proceed to Phase 3 until user explicitly approves. Do not auto-approve. Do not proceed without explicit user confirmation.

**When user approves:** Alefrank explicitly states:

> "Plan approved. Handing off to Julian for implementation."

