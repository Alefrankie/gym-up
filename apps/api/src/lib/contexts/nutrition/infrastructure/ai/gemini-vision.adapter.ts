// src/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter.ts
//
// Production adapter for the AI analyze endpoint — calls Google
// Gemini Vision (`gemini-2.5-flash`) per ADR-014.
//
// Implementation notes:
//   - Format-aware MIME mapping: jpg→image/jpeg, png→image/png,
//     webp→image/webp. Driven by `ContentTypes[format]` — never
//     hardcoded (per Alefrank A4 / D4).
//   - 30-second timeout enforced via `AbortController`. The timer is
//     always cleared in `finally` (no leaked timers across calls /
//     tests — per anti-pattern 6).
//   - `fetchFn` is injectable so tests can intercept HTTP without
//     network (see `gemini-vision.adapter.test.ts`).
//   - Bytes-to-base64 conversion prefers `Buffer` (Node) but falls
//     back to a `btoa` loop so the adapter survives the Edge runtime.

import {
  AIAnalysisRules,
} from '../../domain/nutrition.constants';
import {
  AIUnrecognizedFoodError,
  AITimeoutError,
  MissingApiKeyError,
} from '../../domain/errors';
import {
  ContentTypes,
  type PhotoFormat,
} from '../../domain/nutrition.types';
import type {
  AIAnalysisPort,
  AnalyzePhotoInput,
  AnalyzePhotoOutput,
} from '../../domain/ports/ai-analysis.port';
import { parseGeminiResponse } from '../../application/parse-gemini-response';

const PROVIDER_NAME = 'Gemini Vision';
const ENV_VAR_NAME = 'GEMINI_API_KEY';
const PROMPT =
  `You are a nutrition analysis API. Analyze this food photo and estimate calories and macronutrients.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation, no code blocks.

Expected JSON schema:
{
  "total_calories": <number>,
  "total_protein": <number in grams>,
  "total_carbs": <number in grams>,
  "total_fat": <number in grams>,
  "food_items": [
    {
      "name": "<food item name>",
      "estimated_calories": <number>,
      "estimated_protein": <number in grams>,
      "estimated_carbs": <number in grams>,
      "estimated_fat": <number in grams>
    }
  ]
}

If you cannot identify the food, return: {"error": "unrecognized"}

Do not include any text outside the JSON object.`;

export interface GeminiVisionAdapterOptions {
  /** Override the model (default: `AIAnalysisRules.DefaultModel`). */
  model?: string;
  /** Override the timeout in ms (default: `AIAnalysisRules.TimeoutMs`). */
  timeoutMs?: number;
  /** Inject a fetch impl (test-only). Defaults to the global `fetch`. */
  fetchFn?: typeof fetch;
}

/**
 * Production adapter. Throws `MissingApiKeyError` on construction
 * if the API key is missing — the composition root must catch this
 * and surface it as a 500 (`Missing API key: GEMINI_API_KEY is not
 * set`).
 */
export class GeminiVisionAdapter implements AIAnalysisPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(apiKey: string, options: GeminiVisionAdapterOptions = {}) {
    if (!apiKey || apiKey.trim() === '') {
      throw new MissingApiKeyError(PROVIDER_NAME, ENV_VAR_NAME);
    }
    this.apiKey = apiKey;
    this.model = options.model ?? AIAnalysisRules.DefaultModel;
    this.timeoutMs = options.timeoutMs ?? AIAnalysisRules.TimeoutMs;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    if (typeof this.fetchFn !== 'function') {
      throw new Error(
        `${PROVIDER_NAME} adapter: global fetch is not available in this runtime.`,
      );
    }
  }

  async analyzePhoto(input: AnalyzePhotoInput): Promise<AnalyzePhotoOutput> {
    const url =
      AIAnalysisRules.GeminiEndpoint.replace('{model}', this.model) +
      `?key=${this.apiKey}`;

    const body = JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: ContentTypes[input.format],
                data: bytesToBase64(input.bytes),
              },
            },
          ],
        },
      ],
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        // Non-2xx from the AI provider — wrap as "unrecognized" so the
        // endpoint can surface a friendly 502. The raw status code is
        // available for debugging via the message.
        throw new AIUnrecognizedFoodError(
          `Food not recognized. Try a clearer photo or better lighting. (provider status ${response.status})`,
        );
      }

      const raw = (await response.json()) as unknown;
      return parseGeminiResponse(raw);
    } catch (err) {
      if (err instanceof AIUnrecognizedFoodError) {
        throw err;
      }
      if (isAbortError(err)) {
        throw new AITimeoutError(
          'Analysis took too long. Try again.',
          this.timeoutMs,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Node-first conversion; falls back to a manual loop for Edge runtimes
 * where `Buffer` is not global.
 */
function bytesToBase64(bytes: Uint8Array): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Buf = (globalThis as any).Buffer;
  if (typeof Buf !== 'undefined') {
    return Buf.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in browsers and modern Node 18+.
  return btoa(binary);
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'AbortError' || err.code === DOMException.ABORT_ERR)
  );
}