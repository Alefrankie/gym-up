---
story_id: "1.3"
round: "round-1"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "completed"
started: "2026-07-27"
completed: "2026-07-27"
owner: "Julian"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-001", "FR-WT-002", "FR-WT-003", "FR-WT-004"]
  flows: ["login.flow.md", "register.flow.md"]
blocked_by: ["story-1.1", "story-1.2"]
blocks: ["story-2.1"]
---

# Story 1.3 — Auth (Local: Register + Login + Sessions)

Parent: [../readme.md](../readme.md)

## Summary

Implement registration and login with a **local, SQLite-backed auth** (password hash + httpOnly session cookie). The same `AuthService` interface is later backed by Supabase Auth in [Round 6](../round-6/readme.md), so no UI change is required at swap time.

## Happy Path

1. Create `auth-form.astro` component (kebab-case per [components.md](../../architecture/components.md#conventions)) used for both register and login.
2. Create `/register` page with `AuthForm` (mode: register).
3. User fills: display name, email, password, routine type, weight unit.
4. `AuthService.register()` validates input, hashes password (argon2 or bcrypt), creates a `profiles` row in the same transaction, and starts a session.
5. Redirect to `/dashboard`.
6. Create `/login` page with `AuthForm` (mode: login).
7. `AuthService.login()` verifies password, creates a session row, sets httpOnly cookie.
8. Redirect to `/dashboard`.

## Auth Service contract (used in Round 1 and Round 6)

```ts
interface AuthService {
  register(input: RegisterInput): Promise<Session>
  login(input: LoginInput): Promise<Session>
  logout(): Promise<void>
  getCurrentUser(): Promise<User | null>
}
```

- **Round 1** (`LocalAuthService`): SQLite `sessions` table + cookie, password hash in `profiles`.
- **Round 6** (`SupabaseAuthService`): delegates to `@supabase/supabase-js` Auth; metadata carries display_name / routine_type / weight_unit; `profiles` row is created by a DB trigger (per the original Round-1 plan).

## Acceptance Criteria

- AC-1.3-01: **Given** a new user on `/register`, **When** they submit valid email/password/display_name/routine_type/weight_unit, **Then** a `profiles` row is created and the user is redirected to `/dashboard`. Per [FR-WT-001](../../prd/features/workout-tracking.md).
- AC-1.3-02: **Given** a successful register/login, **When** the response is sent, **Then** an httpOnly session cookie is set. Per [FR-WT-003](../../prd/features/workout-tracking.md).
- AC-1.3-03: **Given** existing user on `/login`, **When** they submit valid email/password, **Then** a session is created and the user is redirected to `/dashboard`. Per [FR-WT-002](../../prd/features/workout-tracking.md).
- AC-1.3-04: **Given** user with valid session, **When** they visit `/login` or `/register`, **Then** redirect to `/dashboard`. Per [FR-WT-004](../../prd/features/workout-tracking.md).
- AC-1.3-05: Passwords are stored as a secure hash (argon2id or bcrypt with cost ≥ 10). Plaintext passwords are never written to disk or logs.
- AC-1.3-06: The `AuthService` interface is the only auth surface used by UI/SSR code; swapping to `SupabaseAuthService` in Round 6 requires no UI change.

## Tasks

- [x] `T1.3-01` - Create `auth-form.astro` component
- [x] `T1.3-02` - Create `LocalAuthService` implementing the `AuthService` interface
- [x] `T1.3-03` - Add `sessions` table migration + repository
- [x] `T1.3-04` - Create `/register` page
- [x] `T1.3-05` - Create `/login` page
- [x] `T1.3-06` - Add session cookie helpers (httpOnly, SameSite=Lax, Secure in prod)
- [x] `T1.3-07` - Add auth redirect logic (logged-in users skip `/login` and `/register`)
- [x] `T1.3-08` - Wire `LocalAuthService` into the per-context composition root (ADR-010)
