# ADR-005: Private Progress Photos

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

**Status:** Accepted · **Date:** 2026-07-21

## Context

Progress photos are personal. Should not be visible to family.

## Decision

Private Supabase Storage bucket. Owner-only via signed URLs. Never in public view.

## Rationale

- Privacy guaranteed at Storage level
- Supabase handles CDN and RLS

## Consequences

- Bucket `progress-photos` with `public: false`
- Limit 5 photos per workout

## Referenced by

- [private-photos](../../prd/features/private-photos.md)
- [public-view](../../prd/features/public-view.md)
