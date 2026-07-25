# Phase 1.5 — Angel ↔ Alefrank Alignment Loop

**Purpose:** Angel and Alefrank cross-check each other automatically before Julian starts. Catches missed scenarios, misread specs, and scope gaps without bothering the user — unless the discrepancy is too significant to resolve internally.

## The loop

1. **Alefrank reviews Angel's output:**
   - Cross-references Angel's acceptance criteria against the actual specs
   - Cross-references against relevant `.pattern.md` files — does Angel's scope match the pattern contract?
   - Checks: did Angel miss any scenarios, edge cases, or integration points?
   - Checks: did Angel misinterpret any spec requirement?
   - Checks: are there legacy behaviors Angel did not flag?
   - Checks: does the pattern file impose constraints Angel did not capture?

2. **If Alefrank finds discrepancies:**
   - Alefrank lists each discrepancy with spec reference
   - **Minor discrepancies** (missing edge case, overlooked scenario): Alefrank sends back to Angel. Angel re-reads the spec, rectifies or explains why it was excluded. Angel updates output. Alefrank re-reviews.
   - **Major discrepancies** (conflicting interpretation of core requirement, scope disagreement, ambiguous spec that both read differently): STOP. Both present their positions to the user. User decides. Loop resumes after user input.

3. **Discrepancy severity:**
   - **Minor:** count mismatch, missing edge case, overlooked integration point, fixture concern — Angel and Alefrank resolve autonomously
   - **Major:** conflicting spec interpretation, scope disagreement, behavioral contract ambiguity, legacy behavior conflict — escalate to user

4. **Loop continues until:**
   - Alefrank finds zero discrepancies
   - OR all discrepancies resolved (minor by crew, major by user)

## Alefrank's alignment output

```
## Alefrank — Alignment Check (Round N)

### Discrepancies Found
| # | Type | Description | Spec Reference | Severity |
|---|------|-------------|----------------|----------|
| 1 | [missing/misinterpreted/ambiguous] | [description] | [spec:section] | Minor/Major |

### Resolution
- [#]: [Angel's response / User's decision]

### Verdict
[ALIGNED / NEEDS ANOTHER ROUND / ESCALATED TO USER]
```

## Angel's rectification output

```
## Angel — Rectification (Round N)

### Corrections
- [what was updated and why]

### Updated Acceptance Criteria
- [full updated list]
```

**Max auto-rounds:** 3. If Angel and Alefrank cannot align after 3 rounds without user input, escalate to user regardless of severity.

**When aligned:** Alefrank explicitly states:

> "Angel and I are aligned. Spec coverage is complete. No legacy behavior at risk. I approve Julian to start implementation."
