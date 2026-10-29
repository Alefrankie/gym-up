// tests/nutrition/analyze-meal.use-case.test.ts
//
// TDD red-phase for `AnalyzeMealUseCase` (story-5.1).
//
// The use case is thin: it forwards `(bytes, format)` to the injected
// `AIAnalysisPort` and returns the typed `AIAnalysisResult`. All tests
// use the deterministic `InMemoryAIAnalysisAdapter` — no network, no
// Gemini mocking.
//
// Error-path tests exercise the adapter's ability to surface the
// three typed errors the endpoint maps to 502 / 504 / 500:
//   - AIUnrecognizedFoodError (502)
//   - AITimeoutError (504)
//   - any other Error (500 via endpoint layer)
//
// Plus a forward-trace test: the use case passes `format` through
// to the adapter (the format-aware MIME mapping guarantee).

import { describe, it, expect } from 'vitest';
import { AnalyzeMealUseCase } from '@/lib/contexts/nutrition/application/analyze-meal.use-case';
import { InMemoryAIAnalysisAdapter } from '@/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter';
import {
  AIUnrecognizedFoodError,
  AITimeoutError,
} from '@/lib/contexts/nutrition/domain/errors';
import type {
  AIAnalysisResult,
  PhotoFormat,
} from '@/lib/contexts/nutrition/domain/nutrition.types';

const SAMPLE_RESULT: AIAnalysisResult = {
  total_calories: 500,
  total_protein: 30,
  total_carbs: 60,
  total_fat: 15,
  food_items: [
    {
      name: 'Grilled chicken',
      estimated_calories: 300,
      estimated_protein: 30,
      estimated_carbs: 0,
      estimated_fat: 8,
    },
    {
      name: 'Brown rice',
      estimated_calories: 200,
      estimated_protein: 0,
      estimated_carbs: 60,
      estimated_fat: 7,
    },
  ],
};

const SAMPLE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes

describe('AnalyzeMealUseCase', () => {
  describe('happy path', () => {
    it('forwards bytes + format to the adapter and returns the typed result', async () => {
      const adapter = new InMemoryAIAnalysisAdapter();
      adapter.setNextResult(SAMPLE_RESULT);
      const useCase = new AnalyzeMealUseCase(adapter);

      const result = await useCase.execute({
        bytes: SAMPLE_BYTES,
        format: 'jpg',
      });

      expect(result).toEqual(SAMPLE_RESULT);
      expect(adapter.calls).toHaveLength(1);
      expect(adapter.calls[0]).toEqual({ bytes: SAMPLE_BYTES, format: 'jpg' });
    });

    it('passes each accepted format through unchanged', async () => {
      const formats: PhotoFormat[] = ['jpg', 'png', 'webp'];
      for (const format of formats) {
        const adapter = new InMemoryAIAnalysisAdapter();
        adapter.setNextResult(SAMPLE_RESULT);
        const useCase = new AnalyzeMealUseCase(adapter);

        await useCase.execute({ bytes: SAMPLE_BYTES, format });

        expect(adapter.calls[0].format).toBe(format);
      }
    });
  });

  describe('error paths', () => {
    it('propagates AIUnrecognizedFoodError from the adapter', async () => {
      const adapter = new InMemoryAIAnalysisAdapter();
      adapter.setNextError(new AIUnrecognizedFoodError());
      const useCase = new AnalyzeMealUseCase(adapter);

      await expect(
        useCase.execute({ bytes: SAMPLE_BYTES, format: 'jpg' }),
      ).rejects.toBeInstanceOf(AIUnrecognizedFoodError);
    });

    it('propagates AITimeoutError from the adapter', async () => {
      const adapter = new InMemoryAIAnalysisAdapter();
      adapter.setNextError(new AITimeoutError('boom', 30_000));
      const useCase = new AnalyzeMealUseCase(adapter);

      await expect(
        useCase.execute({ bytes: SAMPLE_BYTES, format: 'jpg' }),
      ).rejects.toBeInstanceOf(AITimeoutError);
    });

    it('propagates generic Error unchanged (endpoint maps to 500)', async () => {
      const adapter = new InMemoryAIAnalysisAdapter();
      adapter.setNextError(new Error('unexpected'));
      const useCase = new AnalyzeMealUseCase(adapter);

      await expect(
        useCase.execute({ bytes: SAMPLE_BYTES, format: 'jpg' }),
      ).rejects.toThrow('unexpected');
    });
  });
});