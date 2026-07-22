# ADR-003: Routines as Seed Data

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

**Status:** Accepted · **Date:** 2026-07-21

## Context

Routines are fixed and predefined. Store in DB or hardcode?

## Decision

Store in database as seed data via SQL migration.

## Rationale

- Editable via Supabase dashboard without code changes
- Frontend stays thinner
- Same pattern for reading routines and user workouts

## Consequences

- `001_initial_schema.sql` includes all seed data
- No admin UI (not needed for family use)

## Referenced by

- [workout-tracking](../../prd/features/workout-tracking.md)
- [database-schema](../database-schema.md)
