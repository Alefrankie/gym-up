// src/lib/contexts/nutrition/nutrition.composition.ts
//
// Per-context composition root (ADR-010) for the nutrition context.
// Story-5.1 scope: AI analyze endpoint only. No repositories yet
// (those land in story-5.3 with the nutrition_entries migration).
//
// Pattern (mirrors `private-photos.composition.ts` and
// `workout-tracking.composition.ts`):
//   - Construct the AI adapter at module load.
//   - Wire it into the use case.
//   - Export the use case as a singleton.
//
// Round-6 Supabase swap: this file is the only seam. The
// `GeminiVisionAdapter` is the only thing that touches an external
// network — swapping providers (or adding a Supabase Edge Function
// wrapper) is a one-class change here.

import { GeminiVisionAdapter } from './infrastructure/ai/gemini-vision.adapter';
import { AnalyzeMealUseCase } from './application/analyze-meal.use-case';
import { AIAnalysisRules } from './domain/nutrition.constants';

const apiKey = process.env.GEMINI_API_KEY ?? '';

/**
 * Production AI adapter. Throws `MissingApiKeyError` on construction
 * when `GEMINI_API_KEY` is not set — the endpoint maps that to 500.
 *
 * We do NOT eagerly construct the adapter here because the missing-key
 * error would crash the entire composition module on import. Instead
 * we expose a lazy factory used by the endpoint.
 */
function buildAIAdapter(): GeminiVisionAdapter {
  return new GeminiVisionAdapter(apiKey, {
    model: AIAnalysisRules.DefaultModel,
    timeoutMs: AIAnalysisRules.TimeoutMs,
  });
}

let analyzeMealUseCaseInstance: AnalyzeMealUseCase | null = null;

/**
 * Lazy singleton. The first call constructs the adapter (and may
 * throw `MissingApiKeyError`); subsequent calls reuse the instance.
 */
export function getAnalyzeMealUseCase(): AnalyzeMealUseCase {
  if (!analyzeMealUseCaseInstance) {
    analyzeMealUseCaseInstance = new AnalyzeMealUseCase(buildAIAdapter());
  }
  return analyzeMealUseCaseInstance;
}

/**
 * For tests that need to inject a different adapter (e.g. the
 * `InMemoryAIAnalysisAdapter`). Resets the singleton.
 *
 * NOT exported in production builds — keep test-only seams out of the
 * runtime surface.
 */
export function __setAnalyzeMealUseCaseForTesting(
  useCase: AnalyzeMealUseCase,
): void {
  analyzeMealUseCaseInstance = useCase;
}