---
story_id: "6.3"
round: "round-6"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking", "private-photos"]
  prd_requirements: ["FR-WT-001", "FR-WT-002", "FR-WT-003", "FR-WT-004", "FR-PP-001", "FR-PP-005"]
  architecture_decisions: ["ADR-001", "ADR-005", "ADR-007", "ADR-010"]
  flows: ["login.flow.md", "register.flow.md", "upload-photo.flow.md"]
blocked_by: ["story-6.1", "story-6.2"]
blocks: []
---

# Story 6.3 — `SupabaseAuthService` + Storage Bucket

Parent: [../readme.md](../readme.md)

## Summary

Replace `LocalAuthService` with `SupabaseAuthService` (delegates to `@supabase/supabase-js` Auth) and provision the `progress-photos` Supabase Storage bucket with owner-only RLS. The `AuthService` interface and `PhotoRepository` contract stay unchanged, so `auth-form.astro` and `photo-upload.astro` / `photo-gallery.astro` need no edits.

## Happy Path

1. Add `@supabase/supabase-js` to dependencies.
2. Implement `SupabaseAuthService` against the `AuthService` interface from [story-1.3](../round-1/story-1.3.md):
   - `register()` → `supabase.auth.signUp({ email, password, options: { data: { display_name, routine_type, weight_unit } } })`. The `auth.users` → `profiles` trigger from 6.1 creates the profile row.
   - `login()` → `supabase.auth.signInWithPassword({ email, password })`.
   - `logout()` → `supabase.auth.signOut()`.
   - `getCurrentUser()` → `supabase.auth.getUser()` joined with `profiles`.
3. Update the composition root so that when `STORAGE_BACKEND=supabase`, `SupabaseAuthService` is wired instead of `LocalAuthService`.
4. Create the Supabase Storage bucket `progress-photos` (private) with RLS so only the owner can read/write their own folder (`progress-photos/{user_id}/*`).
5. Add a small adapter inside `SupabasePhotoRepository` (or a `StorageService` collaborator) that uploads/downloads blobs through the Supabase Storage client and returns short-lived signed URLs to the UI.
6. Update `photo-upload.astro` only to call the existing `PhotoRepository` upload API — no change if the contract already accepted a `Blob`/`File`.
7. Run end-to-end test: register → upload photo → view photo → log in on second device → fail to view first user's photo (RLS enforcement).

## Acceptance Criteria

- AC-6.3-01: `SupabaseAuthService` implements every method of the `AuthService` interface from [story-1.3](../round-1/story-1.3.md) with no signature changes. Per [FR-WT-001](../../prd/features/workout-tracking.md), [FR-WT-002](../../prd/features/workout-tracking.md), [FR-WT-003](../../prd/features/workout-tracking.md), [FR-WT-004](../../prd/features/workout-tracking.md).
- AC-6.3-02: Register creates both an `auth.users` row and a matching `profiles` row (via the trigger from 6.1), then redirects to `/dashboard`. **Given/When/Then** identical to AC-1.3-01.
- AC-6.3-03: Login authenticates via Supabase and redirects to `/dashboard`. **Given/When/Then** identical to AC-1.3-03.
- AC-6.3-04: Logged-in user visiting `/login` or `/register` is redirected to `/dashboard`. **Given/When/Then** identical to AC-1.3-04.
- AC-6.3-05: `LocalAuthService` is preserved and still wired when `STORAGE_BACKEND=sqlite` (regression).
- AC-6.3-06: `progress-photos` bucket exists and is private. A non-owner trying to read another user's photo at `progress-photos/{other_user_id}/*` is rejected by RLS per [ADR-005](../../architecture/decisions/005-private-photos.md). Per [FR-PP-001](../../prd/features/private-photos.md) and [FR-PP-005](../../prd/features/private-photos.md).
- AC-6.3-07: `photo-upload.astro` and `photo-gallery.astro` have **no source code changes** between Round 1 and Round 6 (the swap is invisible to the UI layer).
- AC-6.3-08: Vercel deploy with `STORAGE_BACKEND=supabase` succeeds; end-to-end smoke test on the deployed URL passes.

## Tasks

- [ ] `T6.3-01` - Install `@supabase/supabase-js`
- [ ] `T6.3-02` - Implement `SupabaseAuthService` (`register`, `login`, `logout`, `getCurrentUser`)
- [ ] `T6.3-03` - Update composition root to branch `AuthService` on `STORAGE_BACKEND`
- [ ] `T6.3-04` - Create `progress-photos` Storage bucket (private)
- [ ] `T6.3-05` - Add Storage RLS policies (owner-only on `progress-photos/{auth.uid()}/*`)
- [ ] `T6.3-06` - Add `StorageService` (or extend `SupabasePhotoRepository`) for upload + signed-URL reads
- [ ] `T6.3-07` - E2E test: register, upload photo, view photo, cross-user access denied
- [ ] `T6.3-08` - Verify UI source code is byte-identical to Round 1 for `auth-form.astro`, `photo-upload.astro`, `photo-gallery.astro`
- [ ] `T6.3-09` - Deploy to Vercel with `STORAGE_BACKEND=supabase` and run smoke test
