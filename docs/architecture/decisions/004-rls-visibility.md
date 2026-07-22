# ADR-004: RLS — write own, read all

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

**Status:** Accepted · **Date:** 2026-07-21

## Context

Multi-user app. Each user has own workouts, but family wants to see everyone's progress.

## Decision

- **Write**: Users can only write their own data
- **Read**: All users can read everyone's data
- **Exception**: Photos are private (owner-only)

## Rationale

- Core family feature is seeing others' progress
- RLS supports this natively
- Photos are the only sensitive data

## Consequences

- `workouts`, `workout_entries`, `profiles`: `FOR SELECT USING (true)`
- `progress_photos`: owner-only

## Referenced by

- [public-view](../../prd/features/public-view.md)
- [database-schema](../database-schema.md)
