// tests/nutrition/gemini-vision.adapter.test.ts
//
// TDD red-phase for `GeminiVisionAdapter` (story-5.1).
//
// The adapter uses an injected `fetchFn` so tests can intercept HTTP
// calls without a real network. Each test asserts:
//   - the request body shape (model, format-aware MIME, prompt)
//   - the response is parsed by `parseGeminiResponse`
//   - typed errors propagate (AITimeoutError, AIUnrecognizedFoodError)
//   - the AbortController fires on timeout and `clearTimeout` runs
//     (no leaked timers across tests)

import { describe, it, expect, vi } from 'vitest';
import { GeminiVisionAdapter } from '@/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter';
import {
  AIUnrecognizedFoodError,
  AITimeoutError,
  MissingApiKeyError,
} from '@/lib/contexts/nutrition/domain/errors';
import type { PhotoFormat } from '@/lib/contexts/nutrition/domain/nutrition.types';

const VALID_GEMINI_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              total_calories: 500,
              total_protein: 30,
              total_carbs: 60,
              total_fat: 15,
              food_items: [
                {
                  name: 'Chicken',
                  estimated_calories: 300,
                  estimated_protein: 30,
                  estimated_carbs: 0,
                  estimated_fat: 8,
                },
              ],
            }),
          },
        ],
      },
    },
  ],
};

const SAMPLE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function makeFetchOk(body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function makeFetchHang(): typeof fetch {
  return vi.fn(async (_url: unknown, init: RequestInit | undefined) => {
    // Honor the abort signal so the adapter's timeout actually fires.
    return new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }
    });
  });
}

describe('GeminiVisionAdapter', () => {
  describe('construction', () => {
    it('throws MissingApiKeyError when apiKey is empty', () => {
      expect(() => new GeminiVisionAdapter('')).toThrow(MissingApiKeyError);
    });

    it('throws MissingApiKeyError when apiKey is whitespace only', () => {
      expect(() => new GeminiVisionAdapter('   ')).toThrow(MissingApiKeyError);
    });
  });

  describe('happy path', () => {
    it('returns parsed AIAnalysisResult from the Gemini response', async () => {
      const fetchFn = makeFetchOk(VALID_GEMINI_RESPONSE);
      const adapter = new GeminiVisionAdapter('test-key', {
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      const result = await adapter.analyzePhoto({
        bytes: SAMPLE_BYTES,
        format: 'jpg',
      });

      expect(result.total_calories).toBe(500);
      expect(result.food_items[0].name).toBe('Chicken');
    });

    it('sends the default model in the URL', async () => {
      const fetchFn = makeFetchOk(VALID_GEMINI_RESPONSE);
      const adapter = new GeminiVisionAdapter('test-key', {
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      await adapter.analyzePhoto({ bytes: SAMPLE_BYTES, format: 'jpg' });

      const calledUrl = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(String(calledUrl)).toContain('gemini-2.5-flash');
      expect(String(calledUrl)).toContain('test-key');
    });

    it('sends a JSON body with prompt + inline image data', async () => {
      const fetchFn = makeFetchOk(VALID_GEMINI_RESPONSE);
      const adapter = new GeminiVisionAdapter('test-key', {
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      await adapter.analyzePhoto({ bytes: SAMPLE_BYTES, format: 'jpg' });

      const init = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1];
      const body = JSON.parse(init.body as string);
      expect(body.contents).toHaveLength(1);
      const parts = body.contents[0].parts;
      expect(parts).toHaveLength(2);
      expect(parts[0].text).toMatch(/food photo/i);
      expect(parts[1].inline_data.mime_type).toBe('image/jpeg');
      expect(typeof parts[1].inline_data.data).toBe('string');
    });

    it('maps format → mime_type (jpg→jpeg, png→png, webp→webp)', async () => {
      const cases: Array<{ format: PhotoFormat; mime: string }> = [
        { format: 'jpg', mime: 'image/jpeg' },
        { format: 'png', mime: 'image/png' },
        { format: 'webp', mime: 'image/webp' },
      ];

      for (const { format, mime } of cases) {
        const fetchFn = makeFetchOk(VALID_GEMINI_RESPONSE);
        const adapter = new GeminiVisionAdapter('test-key', {
          fetchFn: fetchFn as unknown as typeof fetch,
        });

        await adapter.analyzePhoto({ bytes: SAMPLE_BYTES, format });

        const init = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1];
        const body = JSON.parse(init.body as string);
        expect(body.contents[0].parts[1].inline_data.mime_type).toBe(mime);
      }
    });
  });

  describe('error paths', () => {
    it('throws AITimeoutError when fetch never resolves and aborts', async () => {
      const fetchFn = makeFetchHang();
      const adapter = new GeminiVisionAdapter('test-key', {
        fetchFn: fetchFn as unknown as typeof fetch,
        // Use a tiny timeout for fast tests.
        timeoutMs: 50,
      });

      await expect(
        adapter.analyzePhoto({ bytes: SAMPLE_BYTES, format: 'jpg' }),
      ).rejects.toBeInstanceOf(AITimeoutError);
    });

    it('throws AIUnrecognizedFoodError on malformed Gemini response', async () => {
      const fetchFn = makeFetchOk({ garbage: true });
      const adapter = new GeminiVisionAdapter('test-key', {
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      await expect(
        adapter.analyzePhoto({ bytes: SAMPLE_BYTES, format: 'jpg' }),
      ).rejects.toBeInstanceOf(AIUnrecognizedFoodError);
    });

    it('throws AIUnrecognizedFoodError when inner food_items is empty', async () => {
      const empty = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    total_calories: 0,
                    total_protein: 0,
                    total_carbs: 0,
                    total_fat: 0,
                    food_items: [],
                  }),
                },
              ],
            },
          },
        ],
      };
      const fetchFn = makeFetchOk(empty);
      const adapter = new GeminiVisionAdapter('test-key', {
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      await expect(
        adapter.analyzePhoto({ bytes: SAMPLE_BYTES, format: 'jpg' }),
      ).rejects.toBeInstanceOf(AIUnrecognizedFoodError);
    });
  });
});