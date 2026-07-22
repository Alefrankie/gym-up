# Upload Photo Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - Photo Upload Trigger

User taps "Upload photo" on `/photos` page or workout summary. File picker opens (accept: jpg, png, webp).

### Step 2 - Client-Side Processing

Client validates file size (max 5MB). Resizes/compresses image client-side (canvas re-encode).

### Step 3 - Storage Upload

Client uploads compressed image to Supabase Storage: `progress-photos/{user_id}/{timestamp}.jpg`. Storage RLS validates `(storage.foldername(name))[1] = auth.uid()::text`.

### Step 4 - DB Record Creation

Client inserts `progress_photos` row: `user_id`, `storage_path`, `photo_date = today`, `caption` (optional).

### Step 5 - Gallery Refresh

Gallery page re-fetches user's photos. Generates signed URLs (temporary, secure). Displays in chronological grid.

---

## Failure: File Too Large

Step 2 fails if file > 5MB. Shows error: "Max 5MB per photo".

## Failure: Storage RLS

Step 3 fails if user tries to upload to another user's folder. RLS policy blocks insert.

## Delete Flow

User taps delete on a photo. Confirmation dialog. Client deletes `progress_photos` DB record + storage file.
