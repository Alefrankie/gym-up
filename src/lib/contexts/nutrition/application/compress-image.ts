// src/lib/contexts/nutrition/application/compress-image.ts
//
// Image compression helper, extracted from photo-upload.astro so it can
// be unit-tested with fake browser APIs. Both photo-upload.astro and
// meal-photo-capture.astro call `compressImage(file)` (no deps arg) —
// the default deps use the browser's native createImageBitmap + canvas.
//
// The 1024 px / JPEG 0.85 targets are pinned in
// docs/architecture/contexts/nutrition/flows/analyze-meal.flow.md Step 2.
// Files ≤ 1 MB are skipped (already small enough for the 5 MB endpoint
// cap).

export interface CompressionDeps {
  createImageBitmap: (file: Blob) => Promise<ImageBitmap | null>;
  canvasFactory: () => HTMLCanvasElement | null;
  toBlob: (
    canvas: HTMLCanvasElement,
    type: string,
    quality: number,
  ) => Promise<Blob | null>;
}

export interface CompressionOptions {
  maxDimension: number;
  quality: number;
  skipBelowBytes: number;
}

export const DEFAULT_COMPRESSION: CompressionOptions = {
  maxDimension: 1024,
  quality: 0.85,
  skipBelowBytes: 1024 * 1024, // 1 MB
} as const;

/**
 * Compress `file` to JPEG at ≤ `maxDimension` px and the given quality.
 * Returns the file unchanged if any browser API fails or the file is
 * already below `skipBelowBytes`. The output filename's extension is
 * replaced with `.jpg`.
 */
export async function compressImage(
  file: File,
  options: Partial<CompressionOptions> = {},
  deps: CompressionDeps = defaultBrowserDeps(),
): Promise<File> {
  const opts: CompressionOptions = { ...DEFAULT_COMPRESSION, ...options };

  if (file.size <= opts.skipBelowBytes) {
    return file;
  }

  const bitmap = await deps.createImageBitmap(file);
  if (!bitmap) return file;

  const { width, height } = scaleDimensions(
    bitmap.width,
    bitmap.height,
    opts.maxDimension,
  );

  const canvas = deps.canvasFactory();
  if (!canvas) return file;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await deps.toBlob(canvas, 'image/jpeg', opts.quality);
  if (!blob) return file;

  const name = replaceExtension(file.name, 'jpg');
  return new File([blob], name, { type: 'image/jpeg' });
}

/**
 * Scale `w` × `h` down proportionally so neither dimension exceeds `max`.
 * Pure function — exposed for testability and reuse.
 */
export function scaleDimensions(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/**
 * Replace the last extension in `filename` with `ext`. If `filename` has
 * no extension, append `.${ext}`.
 */
export function replaceExtension(filename: string, ext: string): string {
  const dot = filename.lastIndexOf('.');
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  return `${base}.${ext}`;
}

// ---------- browser defaults ---------------------------------------------

function defaultBrowserDeps(): CompressionDeps {
  return {
    createImageBitmap: async (file) =>
      typeof createImageBitmap === 'function'
        ? createImageBitmap(file).catch(() => null)
        : null,
    canvasFactory: () => {
      if (typeof document === 'undefined') return null;
      return document.createElement('canvas');
    },
    toBlob: async (canvas, type, quality) =>
      new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), type, quality),
      ),
  };
}
