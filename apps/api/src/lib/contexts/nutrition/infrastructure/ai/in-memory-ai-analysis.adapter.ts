// src/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter.ts
//
// Deterministic test double for `AIAnalysisPort`. Use cases under test
// inject this instead of the real Gemini adapter — no network, no
// API keys, no flakiness.
//
// The adapter is *scripted*: tests set the next result (or error)
// before invoking the use case. Every call is recorded so tests can
// assert on inputs forwarded by the use case.

import type {
  AIAnalysisResult,
  PhotoFormat,
} from '../../domain/nutrition.types';
import type {
  AIAnalysisPort,
  AnalyzePhotoInput,
  AnalyzePhotoOutput,
} from '../../domain/ports/ai-analysis.port';

interface RecordedCall {
  bytes: Uint8Array;
  format: PhotoFormat;
}

/**
 * Scriptable in-memory adapter for `AIAnalysisPort`. Never used in
 * production — only inside the `tests/nutrition/` directory.
 */
export class InMemoryAIAnalysisAdapter implements AIAnalysisPort {
  private nextResult: AIAnalysisResult | null = null;
  private nextError: Error | null = null;
  /** Recorded inputs from every call (oldest first). */
  readonly calls: RecordedCall[] = [];

  /** Script the next successful call to return this result. */
  setNextResult(result: AIAnalysisResult): void {
    this.nextResult = result;
    this.nextError = null;
  }

  /** Script the next call to throw this error. */
  setNextError(error: Error): void {
    this.nextError = error;
    this.nextResult = null;
  }

  async analyzePhoto(input: AnalyzePhotoInput): Promise<AnalyzePhotoOutput> {
    this.calls.push({ bytes: input.bytes, format: input.format });

    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
    if (this.nextResult) {
      const result = this.nextResult;
      this.nextResult = null;
      return result;
    }
    throw new Error(
      'InMemoryAIAnalysisAdapter: no result scripted. Call setNextResult() or setNextError() before invoking the use case.',
    );
  }
}