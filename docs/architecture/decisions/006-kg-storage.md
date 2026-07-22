# ADR-006: Store in kg, display per unit

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

**Status:** Accepted · **Date:** 2026-07-21

## Context

Users may prefer kg or lbs. How to store and display?

## Decision

Store all weight in kg internally. `profiles.weight_unit` controls display. Conversion: `lbs = kg * 2.20462`.

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
