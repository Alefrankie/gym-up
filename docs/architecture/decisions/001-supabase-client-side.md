# ADR-001: Supabase Client-side SDK

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

**Status:** Accepted · **Date:** 2026-07-21

## Context

Need to decide how frontend communicates with Supabase: directly from browser or through server-side API routes.

## Decision

Use `@supabase/supabase-js` directly in the browser. Astro pages call Supabase via client-side JS in `<script>` tags or React islands.

## Rationale

- Simpler than server-side API routes for CRUD
- RLS handles auth at DB level
- No need for custom API layer

## Consequences

- Supabase URL and anon key are public (by design — RLS protects data)
- Security depends entirely on RLS policies

## Referenced by

- [system.md](../system.md)
- [workout-tracking](../../prd/features/workout-tracking.md)
