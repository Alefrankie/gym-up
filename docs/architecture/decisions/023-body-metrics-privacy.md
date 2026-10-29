---
id: ADR-023
title: Body Metrics Are Owner-Only
type: decision
status: accepted
date: 2026-10-01
---

# ADR-023: Body Metrics Are Owner-Only

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted. Extends the exception list of [ADR-004](./004-rls-visibility.md) (photos → photos, nutrition, body metrics, readiness).

## Context

Hevy lets users log body weight, body fat and body measurements. They are private to the user and never appear on the profile or feed. Phase 1 already treats photos ([ADR-005](./005-private-photos.md)) and nutrition as owner-only.

## Decision

1. `body_measurements` is **owner-only** for every operation (select, insert, update, delete), like `progress_photos`.
2. It never appears in public view, the feed, member cards, share images or exports of other users.
3. Measurements follow Hevy's set. Lengths are stored in **cm** and weight in **kg** ([ADR-006](./006-kg-storage.md)). Display follows `profiles.weight_unit` (kg → cm, lbs → in).
4. The latest body weight is readable by the owner's own contexts through `BodyWeightPort` (e.g. bodyweight-exercise volume, AI summary). It is never exposed cross-user.

## Rationale

- Body weight is more sensitive than training volume. Hevy and every comparable app keep it private.
- It matches the existing photo/nutrition precedent, so there is no new RLS pattern.

## Consequences

- RLS: `body_measurements_{select,insert,update,delete}_own` with `auth.uid() = user_id`.
- `SqliteBodyMeasurementRepository` guards every query with `where user_id = ?` ([ADR-007](./007-repository-pattern.md)).
- An integration test as a non-owner must fail to read ([story-11.1](../../stories/phase-2/round-11/story-11.1.md)).

## Referenced by

- [body-metrics PRD](../../prd/features/body-metrics.md)
- [database-schema.md](../database-schema.md)
