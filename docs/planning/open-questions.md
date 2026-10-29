# Open Questions

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

Unresolved decisions that need input before implementation.

## Questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-001 | Should exercise names be in Spanish or English in the UI? | Product | resolved — English in UI |
| OQ-002 | Should we add exercise instructions/videos in the future? | Product | resolved (2026-10-01) — text instructions for every system exercise + optional external video link, no hosting ([ADR-017](../architecture/decisions/017-exercise-catalog.md)) |
| OQ-003 | What happens if user changes routine type mid-week? | Product | resolved (2026-10-01) — weekday mapping removed; rotation restarts at routine 1 of the new active program, history untouched ([ADR-019](../architecture/decisions/019-rotation-scheduling-and-onboarding.md)) |

## Phase 2 — Questions settled by the tie-break rule

Rule ([stories/phase-2](../stories/phase-2/readme.md)): Hevy first, then Gravl, then simplest.

| ID | Question | Answer | Source |
|----|----------|--------|--------|
| OQ-004 | Are body weight / measurements visible to family? | No, owner-only | Hevy · [ADR-023](../architecture/decisions/023-body-metrics-privacy.md) |
| OQ-005 | Which PR types exist and which 1RM formula? | Hevy record set; Epley, at most 12 reps | Hevy · [ADR-020](../architecture/decisions/020-personal-records.md) |
| OQ-006 | How big are load increments? | By equipment + lower/upper body; plate-rounded; capped by HealthRules | Gravl · [ADR-021](../architecture/decisions/021-progression-engine.md) |
| OQ-007 | Weekday schedule or rotation? | Rotation ("next workout") | Gravl · [ADR-019](../architecture/decisions/019-rotation-scheduling-and-onboarding.md) |
| OQ-008 | Do Phase 1 session minimums (3 exercises, 15 min) still block finishing? | No; only 1 completed set is required | Hevy · [ADR-016](../architecture/decisions/016-workout-data-model-v2.md) |
| OQ-009 | Follow graph or everyone-sees-everyone? | Family feed, no follow graph | gym-up model · [ADR-024](../architecture/decisions/024-social-interactions.md) |
| OQ-010 | Are custom exercises visible to siblings? | Visible (read), not reusable by them | Hevy (custom exercises are personal) + family read-all · [ADR-017](../architecture/decisions/017-exercise-catalog.md) |
| OQ-011 | Offline scope? | Live workout fully offline; other pages cached read-only | Hevy · [ADR-025](../architecture/decisions/025-offline-live-workout.md) |
| OQ-012 | Multiple workouts per day? | Yes; one in-progress at a time | Hevy · [ADR-016](../architecture/decisions/016-workout-data-model-v2.md) |
| OQ-013 | AI in the progression engine? | No; deterministic rules. AI only phrases the weekly summary | Gravl-like UX, simplest implementation · [ADR-021](../architecture/decisions/021-progression-engine.md), [ADR-026](../architecture/decisions/026-weekly-ai-coach-summary.md) |
