# Round 9 — Live Workout v2

Parent: [../readme.md](../readme.md) · Phase: 2

## Purpose

Replace the Phase 1 form-based workout page with a Hevy-grade live session:

- one React island ([ADR-015](../../../architecture/decisions/015-live-workout-react-island.md)) on the v2 model ([ADR-016](../../../architecture/decisions/016-workout-data-model-v2.md));
- the new navigation and the training settings;
- the gym tools.

## Why this round exists

This is the screen users spend 95 % of their time on. Every Hevy logging feature lives here, and so do the hooks Round 10 plugs into: suggestion chips, PR baselines and readiness.

## Strategy

1. **Island skeleton + session commands** (9.1): start in any of 4 modes; add/remove/reorder/replace exercises; supersets; header stats; discard. The outbox sends online only (offline comes in 12.3).
2. **Set rows** (9.2): metrics by exercise type, set types, Previous, RPE, per-exercise rest timer, cardio.
3. **Finish & after** (9.3): finish dialog, summary v2, edit/delete, repeat, save as routine, history v2.
4. **Shell** (9.4): tab bar, in-progress banner, `/profile` hub, training settings (needed by timers and tools).
5. **Tools** (9.5): plate, warm-up and 1RM calculators.

Round 10 extension points are built here as **no-op ports**: `SuggestionPort` returns nothing and `RecordBaselinePort` returns empty baselines, so the island renders chips and badges once Round 10 wires real adapters.

## Stories

| ID | Title | Size | Status |
|----|-------|------|--------|
| [story-9.1.md](./story-9.1.md) | Live workout island — session & exercises | L | ready |
| [story-9.2.md](./story-9.2.md) | Set rows v2, Previous, RPE, per-exercise rest timer, cardio | L | ready |
| [story-9.3.md](./story-9.3.md) | Finish, summary v2, edit/delete, save as routine, history v2 | M | ready |
| [story-9.4.md](./story-9.4.md) | Navigation v2, profile hub, training settings | M | ready |
| [story-9.5.md](./story-9.5.md) | Gym tools: plate calculator, warm-up generator, 1RM calculator | S | ready |

## Acceptance Criteria (round-level)

- AC-R9-01: A user can log a full routine workout and an empty workout end-to-end on mobile width (360 px), including a superset, a warm-up set, a drop set, a bodyweight exercise and a treadmill entry.
- AC-R9-02: The *Anterior* column shows the last session's values for every exercise that has history.
- AC-R9-03: The rest timer stays correct after locking the phone for 60 s (absolute end time).
- AC-R9-04: A completed workout can be edited (add a set, change a weight) and deleted; history and progress reflect it.
- AC-R9-05: `exercise-card.astro` and `src/lib/client/auto-save.ts` are deleted; no page imports them.
- AC-R9-06: The tab bar (Inicio, Entrenar, Progreso, Perfil) and the in-progress banner are present on every authenticated page.
