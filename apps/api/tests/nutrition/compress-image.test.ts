// tests/nutrition/compress-image.test.ts
//
// Unit tests for `compressImage` helper extracted from photo-upload.astro.
//
// Dependency injection (CompressionDeps) makes the function testable in
// node — tests inject fake createImageBitmap / canvas / toBlob. The
// production component calls `compressImage(file)` without deps and the
// default deps use the browser's native APIs.
//
// Coverage:
//   - file ≤ 1 MB → returns file unchanged (no decode)
//   - file > 1 MB → compresses to JPEG, max 1024 px, quality 0.85
//   - aspect ratio preserved on scaling
//   - output filename replaces extension with .jpg
//   - graceful no-op when any browser API fails (returns input file)
//   - pure helpers (scaleDimensions, replaceExtension) covered too

import { describe, it, expect, vi } from 'vitest';
import {
  compressImage,
  scaleDimensions,
  replaceExtension,
  DEFAULT_COMPRESSION,
  type CompressionDeps,
} from '@/lib/contexts/nutrition/application/compress-image';

// ---------- fakes ---------------------------------------------------------

class FakeImageBitmap {
  width: number;
  height: number;
  close = vi.fn();
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
}

class FakeCanvas {
  width = 0;
  height = 0;
  private drawImageMock = vi.fn();
  private ctx = {
    drawImage: (...args: unknown[]) => this.drawImageMock(...args),
  };

  getContext(kind: '2d'): { drawImage: (...args: unknown[]) => void } | null {
    return kind === '2d' ? this.ctx : null;
  }

  toBlob(cb: (b: Blob | null) => void, type: string, _quality: number): void {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type });
    cb(blob);
  }

  getDrawImageCalls(): unknown[][] {
    return this.drawImageMock.mock.calls;
  }
}

interface FakeDeps extends CompressionDeps {
  canvas: FakeCanvas;
  bitmap: FakeImageBitmap;
}

function makeDeps(bitmapW = 2000, bitmapH = 1000): FakeDeps {
  const bitmap = new FakeImageBitmap(bitmapW, bitmapH);
  const canvas = new FakeCanvas();
  return {
    bitmap,
    canvas,
    createImageBitmap: vi.fn(async () => bitmap),
    canvasFactory: () => canvas as unknown as HTMLCanvasElement,
    toBlob: vi.fn(
      (c, type, quality) =>
        new Promise<Blob | null>((resolve) =>
          (c as unknown as FakeCanvas).toBlob((b) => resolve(b), type, quality),
        ),
    ),
  };
}

function makeFile(name: string, sizeBytes: number, type = 'image/jpeg'): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type });
}

// ---------- tests ---------------------------------------------------------

describe('compressImage', () => {
  it('returns the file unchanged when size is at or below skipBelowBytes (1 MB)', async () => {
    const deps = makeDeps();
    const file = makeFile('small.jpg', 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result).toBe(file);
    expect(deps.createImageBitmap).not.toHaveBeenCalled();
  });

  it('compresses when file is above skipBelowBytes', async () => {
    const deps = makeDeps();
    const file = makeFile('meal.jpg', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);

    expect(result).not.toBe(file);
    expect(result.name).toBe('meal.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(deps.createImageBitmap).toHaveBeenCalledTimes(1);
    expect(deps.canvas.width).toBe(DEFAULT_COMPRESSION.maxDimension);
    expect(deps.canvas.height).toBe(512); // 1000 / 2000 * 1024
    expect(deps.bitmap.close).toHaveBeenCalled();
  });

  it('uses DEFAULT_COMPRESSION.maxDimension = 1024', async () => {
    expect(DEFAULT_COMPRESSION.maxDimension).toBe(1024);
    const deps = makeDeps(3000, 1500);
    const file = makeFile('huge.jpg', 5 * 1024 * 1024);
    await compressImage(file, {}, deps);
    expect(deps.canvas.width).toBe(1024);
    expect(deps.canvas.height).toBe(512);
  });

  it('uses DEFAULT_COMPRESSION.quality = 0.85', async () => {
    expect(DEFAULT_COMPRESSION.quality).toBe(0.85);
    const deps = makeDeps();
    const file = makeFile('big.jpg', 2 * 1024 * 1024);
    await compressImage(file, {}, deps);
    // toBlob receives (canvas, type, quality) — assert quality = 0.85
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (deps.toBlob as any).mock.calls[0] as unknown[];
    expect(call?.[2]).toBe(0.85);
  });

  it('respects custom maxDimension override', async () => {
    const deps = makeDeps();
    const file = makeFile('big.jpg', 3 * 1024 * 1024);
    await compressImage(file, { maxDimension: 512 }, deps);
    expect(deps.canvas.width).toBe(512);
    expect(deps.canvas.height).toBe(256);
  });

  it('passes scaled canvas size to drawImage', async () => {
    const deps = makeDeps();
    const file = makeFile('meal.jpg', 3 * 1024 * 1024);
    await compressImage(file, {}, deps);
    const calls = deps.canvas.getDrawImageCalls();
    expect(calls).toHaveLength(1);
    // First arg is the bitmap, then 0,0, scaled width, scaled height
    expect(calls[0]?.[1]).toBe(0);
    expect(calls[0]?.[2]).toBe(0);
    expect(calls[0]?.[3]).toBe(1024);
    expect(calls[0]?.[4]).toBe(512);
  });

  it('returns file unchanged when createImageBitmap returns null', async () => {
    const deps = makeDeps();
    deps.createImageBitmap = vi.fn(async () => null);
    const file = makeFile('bad.jpg', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result).toBe(file);
  });

  it('returns file unchanged when canvas factory returns null', async () => {
    const deps = makeDeps();
    deps.canvasFactory = () => null as unknown as HTMLCanvasElement;
    const file = makeFile('bad.jpg', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result).toBe(file);
  });

  it('returns file unchanged when canvas getContext returns null', async () => {
    const deps = makeDeps();
    deps.canvasFactory = () =>
      ({
        width: 0,
        height: 0,
        getContext: () => null,
        toBlob: () => {},
      } as unknown as HTMLCanvasElement);
    const file = makeFile('bad.jpg', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result).toBe(file);
  });

  it('returns file unchanged when toBlob returns null', async () => {
    const deps = makeDeps();
    deps.toBlob = vi.fn(async () => null);
    const file = makeFile('bad.jpg', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result).toBe(file);
  });

  it('replaces the file extension with .jpg in the output filename', async () => {
    const deps = makeDeps();
    const file = makeFile('meal.PNG', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result.name).toBe('meal.jpg');
  });

  it('replaces the file extension with .jpg for webp input', async () => {
    const deps = makeDeps();
    const file = makeFile('meal.webp', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result.name).toBe('meal.jpg');
  });

  it('replaces the file extension with .jpg for files without extension', async () => {
    const deps = makeDeps();
    const file = makeFile('meal', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result.name).toBe('meal.jpg');
  });

  it('handles filenames with dots in the base (replaces only last extension)', async () => {
    const deps = makeDeps();
    const file = makeFile('my.meal.png', 3 * 1024 * 1024);
    const result = await compressImage(file, {}, deps);
    expect(result.name).toBe('my.meal.jpg');
  });

  it('always outputs image/jpeg regardless of input mime type', async () => {
    const deps = makeDeps();
    const pngFile = makeFile('meal.png', 3 * 1024 * 1024, 'image/png');
    const result = await compressImage(pngFile, {}, deps);
    expect(result.type).toBe('image/jpeg');
  });
});

describe('scaleDimensions', () => {
  it('returns original when both dimensions are at or below max', () => {
    expect(scaleDimensions(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });

  it('returns original when both dimensions equal max', () => {
    expect(scaleDimensions(1024, 1024, 1024)).toEqual({ width: 1024, height: 1024 });
  });

  it('scales down proportionally when width is the larger dimension', () => {
    expect(scaleDimensions(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 });
  });

  it('scales down proportionally when height is the larger dimension', () => {
    expect(scaleDimensions(1024, 2048, 1024)).toEqual({ width: 512, height: 1024 });
  });

  it('handles square images that exceed max', () => {
    expect(scaleDimensions(2000, 2000, 1024)).toEqual({ width: 1024, height: 1024 });
  });

  it('rounds to nearest integer', () => {
    expect(scaleDimensions(1000, 500, 333)).toEqual({ width: 333, height: 167 });
  });
});

describe('replaceExtension', () => {
  it('replaces existing extension', () => {
    expect(replaceExtension('meal.png', 'jpg')).toBe('meal.jpg');
  });

  it('appends extension when no extension exists', () => {
    expect(replaceExtension('meal', 'jpg')).toBe('meal.jpg');
  });

  it('handles filenames with dots in the base (only replaces last ext)', () => {
    expect(replaceExtension('my.meal.png', 'jpg')).toBe('my.meal.jpg');
  });

  it('handles empty string', () => {
    expect(replaceExtension('', 'jpg')).toBe('.jpg');
  });
});
