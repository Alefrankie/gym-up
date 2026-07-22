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

# Story 4.2 — Private Photos

Parent: [../readme.md](../readme.md)

## Summary

Upload, view, and delete private progress photos.

## Happy Path

1. User opens `/photos` or taps "Upload" from workout summary.
2. File picker opens (jpg, png, webp).
3. Client validates size (max 5MB), compresses.
4. Uploads to `progress-photos/{user_id}/{timestamp}.jpg`.
5. Creates `progress_photos` DB record.
6. Gallery shows signed URLs in grid.
7. Tap → fullscreen. Delete → confirmation → remove.

## Acceptance Criteria

- AC-4.2-01: Upload works per [FR-PP-001](../../prd/features/private-photos.md).
- AC-4.2-02: Storage private per [FR-PP-004](../../prd/features/private-photos.md) and [ADR-005](../../architecture/decisions/005-private-photos.md).
- AC-4.2-03: Gallery with signed URLs per [FR-PP-005](../../prd/features/private-photos.md).
- AC-4.2-04: Delete works per [FR-PP-006](../../prd/features/private-photos.md).
- AC-4.2-05: Not visible to other users per [FR-PP-007](../../prd/features/private-photos.md).

## Tasks

- [ ] `T4.2-01` - Create photos page
- [ ] `T4.2-02` - Create PhotoUpload component
- [ ] `T4.2-03` - Handle compression + upload
- [ ] `T4.2-04` - Create PhotoGallery component
- [ ] `T4.2-05` - Add delete with confirmation
- [ ] `T4.2-06` - Generate signed URLs
