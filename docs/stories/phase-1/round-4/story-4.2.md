---
story_id: "4.2"
round: "round-4"
parent_spec: "../../architecture/contexts/private-photos/readme.md"
size: "L"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["private-photos"]
  prd_requirements: ["FR-PP-001", "FR-PP-002", "FR-PP-003", "FR-PP-004", "FR-PP-005", "FR-PP-006", "FR-PP-007"]
  architecture_decisions: ["ADR-005"]
  flows: ["upload-photo.flow.md"]
blocked_by: ["story-4.1"]
blocks: ["story-4.3"]
---

# Story 4.2 — Private Photos (Local Filesystem)

Parent: [../readme.md](../readme.md)

## Summary

Upload, view, and delete private progress photos. Files are stored on the **local filesystem** (e.g. `./uploads/photos/{user_id}/{timestamp}.jpg`); ownership is enforced at the `SqlitePhotoRepository` per [ADR-005](../../architecture/decisions/005-private-photos.md). Supabase Storage + signed URLs are added in [Round 6](../round-6/readme.md) and require no UI change.

## Happy Path

1. User opens `/photos` or taps "Upload" from workout summary.
2. File picker opens (jpg, png, webp).
3. Client validates size (max 5MB), compresses.
4. Uploads to local filesystem at `./uploads/photos/{user_id}/{timestamp}.jpg` via the `LocalPhotoStorage` collaborator (a thin `StorageService` interface).
5. Creates `progress_photos` DB record with the relative path.
6. Gallery reads the file through an authenticated route handler (e.g. `/photos/file/[id]`) that checks ownership via `SqlitePhotoRepository` before streaming the bytes — no public URLs.
7. Tap → fullscreen. Delete → confirmation → remove file + DB row.

## Acceptance Criteria

- AC-4.2-01: Upload works per [FR-PP-001](../../prd/features/private-photos.md).
- AC-4.2-02: Files are not publicly accessible (no signed URLs, no public folder); every read goes through the ownership check per [ADR-005](../../architecture/decisions/005-private-photos.md) and [FR-PP-004](../../prd/features/private-photos.md).
- AC-4.2-03: Gallery renders per [FR-PP-005](../../prd/features/private-photos.md) by loading thumbnails from the authenticated route.
- AC-4.2-04: Delete works per [FR-PP-006](../../prd/features/private-photos.md) and removes both the file and the row.
- AC-4.2-05: Not visible to other users per [FR-PP-007](../../prd/features/private-photos.md); enforced by `SqlitePhotoRepository`.

## Tasks

- [ ] `T4.2-01` - Create photos page
- [ ] `T4.2-02` - Create `src/components/photo-upload.astro`
- [ ] `T4.2-03` - Handle compression + local upload
- [ ] `T4.2-04` - Create `src/components/photo-gallery.astro`
- [ ] `T4.2-05` - Add delete with confirmation
- [ ] `T4.2-06` - Add authenticated route handler for serving photo bytes (ownership check)
