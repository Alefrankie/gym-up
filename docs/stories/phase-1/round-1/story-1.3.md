---
story_id: "1.3"
round: "round-1"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-001", "FR-WT-002", "FR-WT-003", "FR-WT-004"]
  architecture_decisions: ["ADR-001"]
  flows: []
blocked_by: ["story-1.1", "story-1.2"]
blocks: ["story-2.1"]
---

# Story 1.3 — Auth (Register + Login)

Parent: [../readme.md](../readme.md)

## Summary

Implement registration and login with Supabase Auth. Auto-create profile on registration.

## Happy Path

1. Create `/register` page with AuthForm (mode: register).
2. User fills: display name, email, password, routine type, weight unit.
3. Supabase `auth.signUp()` with metadata.
4. DB trigger creates `profiles` row.
5. Redirect to `/dashboard`.
6. Create `/login` page with AuthForm (mode: login).
7. Supabase `auth.signInWithPassword()`.
8. Redirect to `/dashboard`.

## Acceptance Criteria

- AC-1.3-01: **Given** a new user on `/register`, **When** they submit valid email/password/display_name/routine_type/weight_unit, **Then** Supabase creates auth user and redirects to `/dashboard`. Per [FR-WT-001](../../prd/features/workout-tracking.md).
- AC-1.3-02: **Given** auth user created, **When** `auth.users` INSERT fires, **Then** DB trigger creates `profiles` row with id=auth_user.id, display_name, routine_type, weight_unit from metadata. Per [FR-WT-003](../../prd/features/workout-tracking.md).
- AC-1.3-03: **Given** existing user on `/login`, **When** they submit valid email/password, **Then** Supabase authenticates and redirects to `/dashboard`. Per [FR-WT-002](../../prd/features/workout-tracking.md).
- AC-1.3-04: **Given** user with valid session, **When** they visit `/login` or `/register`, **Then** redirect to `/dashboard`. Per [FR-WT-004](../../prd/features/workout-tracking.md).

## Tasks

- [ ] `T1.3-01` - Create AuthForm component
- [ ] `T1.3-02` - Create register page
- [ ] `T1.3-03` - Create login page
- [ ] `T1.3-04` - Add auth redirect logic
