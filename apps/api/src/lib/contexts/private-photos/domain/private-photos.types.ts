// src/lib/contexts/private-photos/domain/private-photos.types.ts
//
// Private Photos — view DTOs. The repository returns raw `ProgressPhoto`
// rows from `db/schema`; the gallery needs a presentation shape with the
// URL the browser will hit (`/photos/file/{id}`) and a human-readable date.

export interface PhotoViewDTO {
  /** UUID of the photo (used for delete + URL). */
  id: string;
  /** Authenticated URL to fetch the bytes — never a public signed URL. */
  url: string;
  /** ISO date string (yyyy-mm-dd or full ISO) used for display. */
  date: string;
  /** Optional caption. `null` when the user didn't set one. */
  caption: string | null;
}

/**
 * Domain constants for private photos. Mirrors the architecture spec
 * (`private-photos/constants.ts`) and the golden-rules (typed literals,
 * not raw strings).
 */
export const PhotoFormats = {
  Jpg: 'jpg',
  Png: 'png',
  Webp: 'webp',
} as const;
export type PhotoFormat = (typeof PhotoFormats)[keyof typeof PhotoFormats];

export const PhotoRules = {
  MaxSizeBytes: 5 * 1024 * 1024,
  MaxCaptionLength: 200,
} as const;

/** Maps a stored photo's `storage_path` extension to a browser MIME type. */
export const ContentTypes: Readonly<Record<PhotoFormat, string>> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

/** Build the authenticated URL the gallery uses for `<img src>`. */
export function buildPhotoUrl(photoId: string): string {
  return `/photos/file/${photoId}`;
}