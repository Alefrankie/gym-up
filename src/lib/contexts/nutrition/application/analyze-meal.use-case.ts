// src/lib/contexts/nutrition/application/analyze-meal.use-case.ts
//
// Use case: validate photo + call the AI port to get calorie/macro
// estimates. Thin orchestration layer — all validation is done at
// the endpoint boundary (base64 decode, size, format); the use case
// just forwards `(bytes, format)` to the port and returns the result.
//
// Per golden-rules "Side-Effect Free Reads" — the use case has a
// single side effect (the AI call) which is at a different boundary
// than the database. It does NOT persist anything (story-5.3's job).

import type {
  AIAnalysisResult,
  PhotoFormat,
} from '../domain/nutrition.types';
import type { AIAnalysisPort } from '../domain/ports/ai-analysis.port';

export interface AnalyzeMealInput {
  /** Decoded image bytes. Endpoint layer is responsible for decoding
   *  and size validation BEFORE handing off to the use case. */
  bytes: Uint8Array;
  /** Validated image format (jpg | png | webp). */
  format: PhotoFormat;
}

export class AnalyzeMealUseCase {
  constructor(private readonly aiPort: AIAnalysisPort) {}

  async execute(input: AnalyzeMealInput): Promise<AIAnalysisResult> {
    return this.aiPort.analyzePhoto({
      bytes: input.bytes,
      format: input.format,
    });
  }
}