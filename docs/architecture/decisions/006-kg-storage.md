# ADR-006: Store in kg, display per unit

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

**Status:** Accepted · **Date:** 2026-07-21

## Context

Users may prefer kg or lbs. How to store and display?

## Decision

Store all weight in kg internally. `profiles.weight_unit` controls display. Conversion: `lbs = kg / 0.45359237` and `kg = lbs * 0.45359237` (exact definition of the pound; Phase 2 supersedes the `2.20462` approximation used by Phase 1 pages, see [Phase 2 decisions](../../stories/phase-2/readme.md#phase-2-decisions-and-resolved-spec-conflicts)). Values are stored unrounded; display rounds.

## Rationale

- Single source of truth avoids inconsistencies
- No data migration if user changes unit
- Conversion is simple math

## Consequences

- `weight_unit` field in `profiles` (default: 'kg')
- Conversion in frontend on display

## Referenced by

- [workout-tracking](../../prd/features/workout-tracking.md)
- [progress](../../prd/features/progress.md)
