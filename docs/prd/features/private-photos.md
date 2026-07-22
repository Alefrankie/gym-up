# Feature — Private Photos

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../README.md)

## Architecture Links

- Database: [architecture/database-schema.md](../../architecture/database-schema.md)
- Decisions: [ADR-005](../../architecture/decisions/005-private-photos.md)

Private progress photos. Owner-only. Never visible in public view.

---

## Functional Requirements

### Upload

#### FR-PP-001

User can upload progress photos (jpg, png, webp, max 5MB). Client-side resize/compress before upload.

#### FR-PP-002

Upload to Supabase Storage: `progress-photos/{user_id}/{timestamp}.jpg`. Creates `progress_photos` DB record with `storage_path`, `photo_date`, `caption`.

#### FR-PP-003

Optional caption after file selection. Max 5 photos per workout.

### Storage

#### FR-PP-004

Private bucket `progress-photos`. RLS ensures only owner can access their folder. Per [ADR-005](../../architecture/decisions/005-private-photos.md).

Storage policies: `(storage.foldername(name))[1] = auth.uid()::text`

### Viewing

#### FR-PP-005

Gallery page: chronological grid of photos. Tap → fullscreen with date + caption. Photos loaded via signed URLs (temporary, secure).

#### FR-PP-006

Delete option with confirmation.

### Privacy

#### FR-PP-007

Photos **never** appear in public view, family member cards, or any data accessible to other users. Per [ADR-005](../../architecture/decisions/005-private-photos.md).

---

## Data

| Table/Storage | Access |
|---------------|--------|
| `progress_photos` | CRUD own (RLS: `auth.uid() = user_id`) |
| Storage `progress-photos` | Read/write own folder only |

## Components

| Component | Spec |
|-----------|------|
| `PhotoGallery` | [components.md](../../architecture/components.md) |
| `PhotoUpload` | [components.md](../../architecture/components.md) |
