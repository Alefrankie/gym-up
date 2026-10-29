# Round 10 — Progression

Parent: [../readme.md](../readme.md) · Phase: 2

## Purpose

Add the coach. In the live workout: PR badges (Hevy, [ADR-020](../../../architecture/decisions/020-personal-records.md)) and next-session suggestions. On top of those: plateau handling, deload weeks, readiness check-in and muscle recovery (Gravl, [ADR-021](../../../architecture/decisions/021-progression-engine.md), [ADR-022](../../../architecture/decisions/022-readiness-and-recovery.md)).

## Why this round exists

Logging alone is Hevy. Telling a beginner what to lift next, and when to back off, is what Gravl adds. It is the main answer to "¿cuánto subo hoy?".

## Strategy

- Every rule is a **pure function** in a domain module (`personal-records.ts`, `progression-engine.ts`, `recovery.ts`), unit-tested table-first with the worked examples from the context docs. Use cases only gather data.
- Round 9 left no-op `SuggestionPort` / `RecordBaselinePort` adapters. This round swaps in real adapters at the composition roots, so the island needs only additive UI (chip, why-sheet, plateau marker, readiness step).
- 10.1 and 10.2 can run in parallel. 10.3 needs both. 10.4 needs 10.2.

## Stories

| ID | Title | Size | Status |
|----|-------|------|--------|
| [story-10.1.md](./story-10.1.md) | Personal records engine & PR badges | M | ready |
| [story-10.2.md](./story-10.2.md) | Load suggestions (double progression) | M | ready |
| [story-10.3.md](./story-10.3.md) | Plateau detection & deload week | M | ready |
| [story-10.4.md](./story-10.4.md) | Readiness check-in & muscle recovery | M | ready |

## Acceptance Criteria (round-level)

- AC-R10-01: Beating a previous best shows a 🏆 badge on the set instantly (also offline after 12.3); the summary lists the PRs; the first-ever session shows none.
- AC-R10-02: After a session where every set hit the top of the range, the next session prefills weight + increment and reps = min, with a "¿Por qué?" explanation.
- AC-R10-03: Three exposures without e1RM improvement mark the exercise "Estancado" and offer the 3 options.
- AC-R10-04: Accepting a deload makes the next 7 days' workouts use 60 % sets and 90 % weight, with a "Descarga" badge.
- AC-R10-05: A readiness score < 2.5 reduces sets and weight for that session only; *Usar plan original* reverts it.
- AC-R10-06: The dashboard shows muscle recovery states consistent with the last 7 days of training.
- AC-R10-07: With `progression_enabled = false`, no chips, plateau markers or deload cards appear (pure Hevy mode).
