# Private Photos Context

Parent: [../readme.md](../readme.md) · PRD: [../../prd/features/private-photos.md](../../../prd/features/private-photos.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Purpose

Private progress photos. Owner-only. Never visible in public view.

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/private-photos/domain/`.

### `private-photos.types.ts`

```ts
// src/lib/contexts/private-photos/domain/private-photos.types.ts

export interface ProgressPhoto {
  id: string;
  user_id: string;
  storage_path: string; // {user_id}/{timestamp}.jpg
  photo_date: string;
  caption: string | null;
  created_at: string;
}

export interface PhotoCreateDTO {
  user_id: string;
  storage_path: string;
  photo_date: string;
  caption: string | null;
}

export interface PhotoView {
  id: string;
  signedUrl: string;
  date: string;
  caption: string | null;
}
```

### `private-photos.constants.ts`

```ts
// src/lib/contexts/private-photos/domain/private-photos.constants.ts

export const PhotoFormats = {
  Jpg: 'jpg',
  Png: 'png',
  Webp: 'webp',
} as const;
export type PhotoFormat = (typeof PhotoFormats)[keyof typeof PhotoFormats];

export const PhotoRules = {
  MaxSizeBytes: 5 * 1024 * 1024, // 5MB
  MaxPerWorkout: 5,
  MaxCaptionLength: 200,
  SignedUrlExpiresSeconds: 3600, // 1 hour
} as const;

export const StoragePaths = {
  Bucket: 'progress-photos',
  PathPattern: '{userId}/{timestamp}.jpg',
} as const;
```

### Entities

- `ProgressPhoto` — photo record. Has `id`, `user_id`, `storage_path`, `photo_date`, `caption`, `created_at`.

### Value Objects

- `StoragePath` — string, pattern: `{user_id}/{timestamp}.jpg`. Per `StoragePaths.PathPattern`.
- `Caption` — optional string, max `PhotoRules.MaxCaptionLength` (200) characters.
- `PhotoDate` — date, defaults to today.

### Invariants

- Photos are PERSONAL body images. Privacy is non-negotiable. Per [`ADR-005`](../decisions/005-private-photos.md).
- Only the OWNER can view, upload, or delete their photos. No exceptions. Per [`ADR-005`](../decisions/005-private-photos.md).
- Photos NEVER appear in public view, family cards, or any data accessible to other users. Per [`ADR-005`](../decisions/005-private-photos.md).
- Max `PhotoRules.MaxPerWorkout` (5) photos per workout. Hard limit. Per [`PRD`](../../prd/features/private-photos.md) FR-PP-003.
- Max `PhotoRules.MaxSizeBytes` (5MB) per photo. Hard limit. Per [`PRD`](../../prd/features/private-photos.md) FR-PP-001.
- Accepted formats: jpg, png, webp. Per `PhotoFormats`. Per [`PRD`](../../prd/features/private-photos.md) FR-PP-001.
- `caption` is optional, max `PhotoRules.MaxCaptionLength` (200) characters.
- `storage_path` follows `StoragePaths.PathPattern`. User ID is first folder for RLS.
- Signed URLs expire after `PhotoRules.SignedUrlExpiresSeconds` (1 hour). Regenerated on each page load.
- Deleting a photo removes BOTH the DB record AND the storage file. Atomic.
- Bucket is `StoragePaths.Bucket` (`progress-photos`), PRIVATE (`public: false`). RLS at storage level. Per [`ADR-005`](../decisions/005-private-photos.md).

### Ports

- `PhotoRepository` — create, getByUserId, delete.
- `PhotoStorageAdapter` — upload, getSignedUrl, delete.

---

## Application

### Use Cases

| Use case | Purpose | Status |
|----------|---------|--------|
| UploadPhotoUseCase | Validate (size, format), compress, upload to storage, create DB record | planned |
| GetMyPhotosUseCase | Fetch user's photo records, generate signed URLs | planned |
| DeletePhotoUseCase | Verify ownership, delete DB record + storage file | planned |

### Orchestration

1. `UploadPhotoUseCase`:
   - Validate file: format (jpg/png/webp), size ≤ 5MB.
   - Compress client-side (canvas re-encode).
   - Generate path: `{userId}/{timestamp}.jpg`.
   - Call `PhotoStorageAdapter.upload(path, file)`.
   - Call `PhotoRepository.create({ user_id, storage_path, photo_date, caption })`.
   - Return photo record.

2. `GetMyPhotosUseCase`:
   - Call `PhotoRepository.getByUserId(userId)`.
   - For each photo, call `PhotoStorageAdapter.getSignedUrl(path)`.
   - Return PhotoViewDTO[].

3. `DeletePhotoUseCase`:
   - Verify photo belongs to user.
   - Call `PhotoRepository.delete(photoId)`.
   - Call `PhotoStorageAdapter.delete(storagePath)`.
   - Return success.

---

## Infrastructure

Per [ADR-007](../decisions/007-repository-pattern.md) and [ADR-011](../decisions/011-implements-not-extends.md).

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/private-photos/domain/ports/photo-repository.ts
abstract class PhotoRepository {
  abstract create(data: PhotoCreateDTO): Promise<ProgressPhoto>;
  abstract getByUserId(userId: string): Promise<ProgressPhoto[]>;
  abstract getById(id: string): Promise<ProgressPhoto | null>;
  abstract delete(id: string): Promise<void>;
}

// src/lib/contexts/private-photos/domain/ports/photo-storage.adapter.ts
abstract class PhotoStorageAdapter {
  abstract upload(path: string, file: File | Buffer): Promise<void>;
  abstract getSignedUrl(path: string, expiresIn: number): Promise<string>;
  abstract delete(path: string): Promise<void>;
}
```

### Supabase Implementation (Production)

```ts
// src/lib/contexts/private-photos/infrastructure/supabase/supabase-photo.repository.ts
class SupabasePhotoRepository implements PhotoRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(data: PhotoCreateDTO): Promise<ProgressPhoto> {
    const { data: row, error } = await this.supabase
      .from('progress_photos')
      .insert({ user_id: data.user_id, storage_path: data.storage_path, photo_date: data.photo_date, caption: data.caption })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  }

  async getByUserId(userId: string): Promise<ProgressPhoto[]> {
    const { data, error } = await this.supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', userId)
      .order('photo_date', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('progress_photos').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

// src/lib/contexts/private-photos/infrastructure/supabase/supabase-photo-storage.adapter.ts
class SupabasePhotoStorageAdapter implements PhotoStorageAdapter {
  constructor(private supabase: SupabaseClient) {}

  async upload(path: string, file: File | Buffer): Promise<void> {
    const { error } = await this.supabase.storage.from('progress-photos').upload(path, file);
    if (error) throw new Error(error.message);
  }

  async getSignedUrl(path: string, expiresIn: number): Promise<string> {
    const { data, error } = await this.supabase.storage.from('progress-photos').createSignedUrl(path, expiresIn);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.supabase.storage.from('progress-photos').remove([path]);
    if (error) throw new Error(error.message);
  }
}
```

### SQLite + Local Storage Implementation (Tests, E2E)

```ts
// src/lib/contexts/private-photos/infrastructure/sqlite/sqlite-photo.repository.ts
class SqlitePhotoRepository implements PhotoRepository {
  constructor(private db: Database) {}

  async create(data: PhotoCreateDTO): Promise<ProgressPhoto> {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO progress_photos (id, user_id, storage_path, photo_date, caption, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, data.user_id, data.storage_path, data.photo_date, data.caption);
    return this.getById(id);
  }

  async getByUserId(userId: string): Promise<ProgressPhoto[]> {
    return this.db.prepare('SELECT * FROM progress_photos WHERE user_id = ? ORDER BY photo_date DESC').all(userId);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM progress_photos WHERE id = ?').run(id);
  }
}

// src/lib/contexts/private-photos/infrastructure/sqlite/local-photo-storage.adapter.ts
class LocalPhotoStorageAdapter implements PhotoStorageAdapter {
  constructor(private basePath: string) {}

  async upload(path: string, file: File | Buffer): Promise<void> {
    const fullPath = path.join(this.basePath, path);
    fs.writeFileSync(fullPath, file);
  }

  async getSignedUrl(path: string, expiresIn: number): Promise<string> {
    return `file://${path.join(this.basePath, path)}?expires=${Date.now() + expiresIn * 1000}`;
  }

  async delete(path: string): Promise<void> {
    fs.unlinkSync(path.join(this.basePath, path));
  }
}
```

### Wiring (Per-Context Composition)

Per [ADR-010](../decisions/010-per-context-composition.md), no central root.

`src/lib/contexts/private-photos/private-photos.composition.ts`:

```ts
import { useSupabase, supabaseClient, sqliteDb } from '@/lib/config';
import { SupabasePhotoRepository } from './infrastructure/supabase/SupabasePhotoRepository';
import { SqlitePhotoRepository } from './infrastructure/sqlite/SqlitePhotoRepository';
import { SupabasePhotoStorageAdapter } from './infrastructure/supabase/SupabasePhotoStorageAdapter';
import { LocalPhotoStorageAdapter } from './infrastructure/sqlite/LocalPhotoStorageAdapter';
import { UploadPhotoUseCase } from './application/UploadPhotoUseCase';
import { GetMyPhotosUseCase } from './application/GetMyPhotosUseCase';
import { DeletePhotoUseCase } from './application/DeletePhotoUseCase';

const photoRepo: PhotoRepository = useSupabase
  ? new SupabasePhotoRepository(supabaseClient)
  : new SqlitePhotoRepository(sqliteDb);

const photoStorage: PhotoStorageAdapter = useSupabase
  ? new SupabasePhotoStorageAdapter(supabaseClient)
  : new LocalPhotoStorageAdapter('./test-storage');

export const uploadPhotoUseCase = new UploadPhotoUseCase(photoRepo, photoStorage);
export const getMyPhotosUseCase = new GetMyPhotosUseCase(photoRepo, photoStorage);
export const deletePhotoUseCase = new DeletePhotoUseCase(photoRepo, photoStorage);
```

---

## UI

### Components

- `PhotoUpload` — file picker + compression + upload.
- `PhotoGallery` — grid view with signed URLs, delete option.

### Interactive components (Astro islands)

- `PhotoUpload.svelte` — Svelte island, file picker + compression + upload.
- `PhotoGallery.svelte` — Svelte island, grid with click-to-fullscreen.

### Pages

- `/photos` — SSR, private gallery.

---

## Testing

Per [ADR-009](../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

`src/test/contexts/private-photos/UploadPhotoUseCase.test.ts`:

```ts
import { faker } from '@faker-js/faker';
import { createTestDb } from '@/test/setup';
import { SqlitePhotoRepository } from '@/lib/contexts/private-photos/infrastructure/sqlite/SqlitePhotoRepository';
import { LocalPhotoStorageAdapter } from '@/lib/contexts/private-photos/infrastructure/sqlite/LocalPhotoStorageAdapter';
import { UploadPhotoUseCase } from '@/lib/contexts/private-photos/application/UploadPhotoUseCase';

describe('UploadPhotoUseCase', () => {
  it('uploads photo and creates DB record', async () => {
    const db = createTestDb();
    const photoRepo = new SqlitePhotoRepository(db);
    const storage = new LocalPhotoStorageAdapter('./test-storage');
    const useCase = new UploadPhotoUseCase(photoRepo, storage);

    const userId = faker.string.uuid();
    const file = Buffer.from(faker.image.dataUri());
    const result = await useCase.execute(userId, file, faker.lorem.sentence());

    expect(result.user_id).toBe(userId);
    expect(result.storage_path).toContain(userId);
  });
});
```

---

## Flows

- [upload-photo.flow.md](./flows/upload-photo.flow.md)
