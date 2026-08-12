// src/lib/contexts/nutrition/domain/ports/ai-analysis.port.ts
//
// Abstract port for AI vision analysis. The contract is provider-
// agnostic so the use case never imports a concrete provider.
//
// Implementations:
//   - GeminiVisionAdapter     (production)
//   - InMemoryAIAnalysisAdapter (deterministic test double)
//
// Per ADR-011 — `implements`, not `extends`.

import type { AIAnalysisResult, PhotoFormat } from '../nutrition.types';

/**
 * Input for `analyzePhoto`.
 *
 * `bytes` is the raw decoded image bytes (NOT base64). The endpoint
 * decodes base64 → bytes before calling this port so adapters never
 * see base64 strings (avoids re-decoding / format-prefix ambiguity).
 *
 * `format` is the canonical validated format from the request body.
 * Adapters use it to set the request MIME type — format-aware mapping
 * is mandatory, do not hardcode `image/jpeg` (per Alefrank A4 / D4).
 */
export interface AnalyzePhotoInput {
  bytes: Uint8Array;
  format: PhotoFormat;
}

/**
 * Output of `analyzePhoto`. Pure data — adapters do NOT wrap or
 * decorate it. The use case performs the empty-food-items invariant
 * check and throws `AIUnrecognizedFoodError` when violated.
 */
export interface AnalyzePhotoOutput extends AIAnalysisResult {}

/**
 * Abstract contract every AI provider adapter must implement.
 *
 * Implementations MUST:
 *   - Enforce the timeout (30s per `AIAnalysisRules.TimeoutMs`).
 *   - Throw `AITimeoutError` on timeout (not a generic Error).
 *   - Throw `AIUnrecognizedFoodError` if the provider response is
 *     empty / unparseable / has zero food items.
 *   - Never throw raw strings or anonymous Errors.
 */
export abstract class AIAnalysisPort {
  abstract analyzePhoto(input: AnalyzePhotoInput): Promise<AnalyzePhotoOutput>;
}