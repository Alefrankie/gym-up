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

- Photos are PERSONAL body images. Privacy is non-negotiable. Per [`ADR-005`](../../decisions/005-private-photos.md).
- Only the OWNER can view, upload, or delete their photos. No exceptions. Per [`ADR-005`](../../decisions/005-private-photos.md).
- Photos NEVER appear in public view, family cards, or any data accessible to other users. Per [`ADR-005`](../../decisions/005-private-photos.md).
- Max `PhotoRules.MaxPerWorkout` (5) photos per workout. Hard limit. Per [`PRD`](../../../prd/features/private-photos.md) FR-PP-003.
- Max `PhotoRules.MaxSizeBytes` (5MB) per photo. Hard limit. Per [`PRD`](../../../prd/features/private-photos.md) FR-PP-001.
- Accepted formats: jpg, png, webp. Per `PhotoFormats`. Per [`PRD`](../../../prd/features/private-photos.md) FR-PP-001.
- `caption` is optional, max `PhotoRules.MaxCaptionLength` (200) characters.
- `storage_path` follows `StoragePaths.PathPattern`. User ID is first folder for RLS.
- Signed URLs expire after `PhotoRules.SignedUrlExpiresSeconds` (1 hour). Regenerated on each page load.
- Deleting a photo removes BOTH the DB record AND the storage file. Atomic.
- Bucket is `StoragePaths.Bucket` (`progress-photos`), PRIVATE (`public: false`). RLS at storage level. Per [`ADR-005`](../../decisions/005-private-photos.md).

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

Per [ADR-007](../../decisions/007-repository-pattern.md) and [ADR-011](../../decisions/011-implements-not-extends.md).

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

Per [ADR-010](../../decisions/010-per-context-composition.md), no central root.

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

### Interactive components (Svelte)

- `PhotoUpload.svelte` — Svelte island, file picker + compression + upload.
- `PhotoGallery.svelte` — Svelte island, grid with click-to-fullscreen.

### Pages

- `/photos` — SSR, private gallery.

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

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
- [compare-photos.flow.md](./flows/compare-photos.flow.md) (Phase 2, story 11.3)

---

## Phase 2

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [11.3](../../../stories/phase-2/round-11/story-11.3.md) |
| Requirements | [FR-PP-008](../../../prd/features/private-photos.md#fr-pp-008), [FR-PP-009](../../../prd/features/private-photos.md#fr-pp-009), [FR-PP-010](../../../prd/features/private-photos.md#fr-pp-010) |
| Decisions | [ADR-005](../../decisions/005-private-photos.md), [ADR-023](../../decisions/023-body-metrics-privacy.md) |

Phase 2 adds photo **comparison**: two photos side by side or under a slider, with the days between them and, when available, the body weight near each date. No new table, no migration, no new RLS policy: `progress_photos` and `body_measurements` are already owner-only.

### Code reality (as built in Phase 1)

The sections above predate the code. Phase 2 builds on what exists:

| Doc above says | Code does |
|---|---|
| `PhotoRepository` in `private-photos/domain/ports/` with `getByUserId` | `src/lib/contexts/workout-tracking/domain/photo.repository.ts`: `findById(id, currentUserId)` (throws `PhotoOwnershipError`), `findByUser(userId)`, `create(input, currentUserId)`, `delete(id, currentUserId)`. `private-photos.composition.ts` reuses `photoRepository` from `workout-tracking.composition.ts` |
| Signed URLs | Bytes are streamed by the authenticated route `src/pages/photos/file/[id].ts`; `buildPhotoUrl(id)` returns `/photos/file/{id}`. Compare uses the same URLs |
| Constants in `private-photos.constants.ts` | Constants live in `private-photos/domain/private-photos.types.ts` (`PhotoRules`, `PhotoFormats`) |
| Svelte gallery island | `src/components/photo-gallery.astro` with an inline client `<script>` (fullscreen modal + `DELETE /api/photos/[id]`) |

### Domain additions

```ts
// src/lib/contexts/private-photos/domain/private-photos.types.ts (additions)

export const PhotoCompareRules = {
  MinPhotos: 2,
  BodyWeightWindowDays: 3,       // FR-PP-009: measurement within ±3 days of the photo date
  SliderDefaultPercent: 50,
  SliderKeyboardStepPercent: 5,
} as const;

export const CompareModes = {
  SideBySide: 'side-by-side',    // "Lado a lado"
  Slider: 'slider',              // "Deslizador"
} as const;
export type CompareMode = (typeof CompareModes)[keyof typeof CompareModes];

export interface ComparePhotoView extends PhotoViewDTO {
  bodyWeightKg: number | null;   // nearest measurement within the window, owner-only
  bodyWeightMeasuredOn: string | null;
}

export interface PhotoComparison {
  left: ComparePhotoView;        // `a` in the URL
  right: ComparePhotoView;       // `b` in the URL
  daysBetween: number;           // |right.date − left.date| in whole days
  bodyWeightDeltaKg: number | null; // right − left, only when both weights exist
  photos: PhotoViewDTO[];        // all of the owner's photos, for the side pickers
}

export class SamePhotoError extends Error {
  constructor(public readonly photoId: string) {
    super(`Cannot compare photo ${photoId} with itself`);
    this.name = 'SamePhotoError';
  }
}
```

**Invariants**

- Both photos MUST belong to the session user. `PhotoRepository.findById(id, currentUserId)` throws `PhotoOwnershipError` for another user's photo; the page answers 404 for both "missing" and "not yours", so a photo id never reveals that it exists.
- Default pair (no `a`/`b` in the URL): `a` = oldest, `b` = newest by `photoDate` (ties by `createdAt`).
- `a` and `b` MUST differ (`SamePhotoError`).
- Fewer than `PhotoCompareRules.MinPhotos` photos → no comparison; the page shows the empty state.
- Body weight comes only from the owner's own `body_measurements`, through `BodyWeightPort`, called with the session user id. It is never shown to or computed for another user ([ADR-023 §4](../../decisions/023-body-metrics-privacy.md)).
- Decision: when two measurements are equally close to a photo date (one before, one after), the earlier one is used (simplest; neither Hevy nor Gravl has the feature).
- Decision: the server keeps the URL order (`a` left, `b` right). *Intercambiar* is client-only and rewrites the query with `history.replaceState`, so a reload keeps the swap.

### Ports consumed

| Port | Provided by | Method used |
|---|---|---|
| `BodyWeightPort` | [body-metrics](../body-metrics/readme.md) ([ADR-023](../../decisions/023-body-metrics-privacy.md)) | `findNearest(userId: string, date: Date, maxDays: number): Promise<{ measuredOn: Date; weightKg: number } \| undefined>` — nearest measurement with `weight_kg IS NOT NULL` within ±`maxDays`. The body-metrics readme is authoritative for the signature |

### Use cases

| Use case | Purpose | Story | Status |
|----------|---------|-------|--------|
| `GetPhotoComparisonUseCase` | Resolve the pair (explicit or default), owner check, days between, nearest body weights and Δ | 11.3 | planned |

File: `src/lib/contexts/private-photos/application/get-photo-comparison.use-case.ts`, constructor `(photoRepository: PhotoRepository, bodyWeightPort: BodyWeightPort)`.

**Orchestration** — `execute({ userId, photoAId?, photoBId? }): Promise<PhotoComparison | undefined>`

1. `photos = photoRepository.findByUser(userId)`. Fewer than 2 → return `undefined` (empty state).
2. If `photoAId`/`photoBId` are given: `findById(id, userId)` for each (missing → `undefined` → page 404; other owner → `PhotoOwnershipError` → page 404). Same id → `SamePhotoError`. Otherwise pick oldest and newest from `photos`.
3. `bodyWeightPort.findNearest(userId, photoDate, PhotoCompareRules.BodyWeightWindowDays)` for both photos, in parallel.
4. `daysBetween = round(|right.photoDate − left.photoDate| / 86 400 000)`; `bodyWeightDeltaKg = right − left` when both weights exist.
5. Map rows with the existing `toPhotoView` (`buildPhotoUrl`).

**Wiring** — `private-photos.composition.ts` adds:

```ts
import { bodyWeightPort } from '@/lib/contexts/body-metrics/body-metrics.composition'; // story 11.1
import { GetPhotoComparisonUseCase } from './application/get-photo-comparison.use-case';

export const getPhotoComparisonUseCase = new GetPhotoComparisonUseCase(photoRepository, bodyWeightPort);
```

### UI

| Item | File | Notes |
|---|---|---|
| Page `/photos/compare?a=&b=` | `src/pages/photos/compare.astro` | SSR auth gate (same shape as `photos.astro`), calls `getPhotoComparisonUseCase`, mounts `PhotoCompare` with `client:load`. 404 page for a missing or foreign photo; `SamePhotoError` → redirect to `/photos/compare` (defaults). Empty state: "Necesitas al menos 2 fotos para comparar" + *Subir foto* |
| `PhotoCompare` island | `src/components/photo-compare.tsx` | Header "N días entre fotos" (singular "1 día"). Mode switch *Lado a lado* / *Deslizador*. *Intercambiar*. Tapping a side's date opens a thumbnail picker of `photos` and navigates with the new `a`/`b` |
| Lado a lado | inside `photo-compare.tsx` | Two equal columns (3:4, `object-fit: cover`), date under each, body weight under the date ("72,4 kg", viewer's unit) and the Δ between them ("−2,4 kg") |
| Deslizador | inside `photo-compare.tsx` | Both images stacked in one 3:4 frame; the right image is clipped with `clip-path: inset(0 0 0 X%)`; a vertical divider with a handle is dragged with pointer events (`setPointerCapture`). The handle is `role="slider"` with `aria-valuenow`, arrow keys move it by `SliderKeyboardStepPercent`. Starts at 50 % |
| Gallery multi-select (FR-PP-010) | `src/components/photo-gallery.astro` | Extends the existing inline script: long-press 500 ms (cancelled by > 10 px movement or early release) enters selection mode; taps then toggle a check; at most 2 (a third tap is ignored with the hint "Elige 2 fotos"); a bottom bar *Comparar (2)* opens `/photos/compare?a=<older>&b=<newer>`; *Cancelar* exits. A *Seleccionar* button enters the same mode without long-press (desktop, accessibility). A *Comparar* header button (≥ 2 photos) opens the default pair |
| `/photos` header | `src/pages/photos.astro` | Shows *Comparar* when the user has ≥ 2 photos |

> Decision: multi-select extends the gallery's existing client script instead of adding a separate React island. Long-press and the existing tap → fullscreen handler must live in the same event handler; two scripts on the same elements would race. This is the code-reality exception to the React-only island rule ([ADR-015](../../decisions/015-live-workout-react-island.md)); `PhotoCompare` itself is a React island.

No new API endpoint: the comparison is SSR, images use the existing `/photos/file/[id]` route.

### Testing

No mocks ([ADR-009](../../decisions/009-object-mothers.md)). `tests/private-photos/get-photo-comparison.use-case.test.ts` with the real `SqlitePhotoRepository` and the real body-metrics SQLite `BodyWeightPort`:

- default pair = oldest vs newest; explicit pair keeps URL order;
- another user's photo id → `PhotoOwnershipError`; unknown id → `undefined`;
- same id twice → `SamePhotoError`; one photo only → `undefined`;
- weight 3 days away is used, 4 days away is not; equal distance → the earlier measurement; Δ only when both weights exist;
- `daysBetween` across a DST change still counts whole days.

RLS: no new table or policy. The existing `tests/supabase/rls-photo.integration.test.ts` and the body-metrics owner-only tests (story 11.1) cover the data. Story 11.3 adds an E2E check that `/photos/compare?a=<sibling photo>` returns 404.

### Flows

- [compare-photos.flow.md](./flows/compare-photos.flow.md)
