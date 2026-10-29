// tests/nutrition/parse-gemini-response.test.ts
//
// TDD red-phase for `parseGeminiResponse` (story-5.1).
//
// The parser takes the raw Gemini REST response (unknown shape) and
// returns a typed `AIAnalysisResult`. It must throw
// `AIUnrecognizedFoodError` for ANY malformed input — the endpoint
// layer maps that to HTTP 502 with a user-facing message.

import { describe, it, expect } from 'vitest';
import {
  parseGeminiResponse,
  // expected to be exported by the implementation file
} from '@/lib/contexts/nutrition/application/parse-gemini-response';
import { AIUnrecognizedFoodError } from '@/lib/contexts/nutrition/domain/errors';
import type { AIAnalysisResult } from '@/lib/contexts/nutrition/domain/nutrition.types';

describe('parseGeminiResponse', () => {
  describe('happy path', () => {
    it('returns a typed result for a well-formed Gemini response', () => {
      const geminiResponse = {
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
                        name: 'Grilled chicken breast',
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
                  }),
                },
              ],
            },
          },
        ],
      };

      const result: AIAnalysisResult = parseGeminiResponse(geminiResponse);

      expect(result).toEqual({
        total_calories: 500,
        total_protein: 30,
        total_carbs: 60,
        total_fat: 15,
        food_items: [
          {
            name: 'Grilled chicken breast',
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
      });
    });

    it('accepts a single-item food_items array', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    total_calories: 100,
                    total_protein: 0,
                    total_carbs: 25,
                    total_fat: 0,
                    food_items: [
                      {
                        name: 'Apple',
                        estimated_calories: 100,
                        estimated_protein: 0,
                        estimated_carbs: 25,
                        estimated_fat: 0,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      const result = parseGeminiResponse(geminiResponse);

      expect(result.food_items).toHaveLength(1);
      expect(result.food_items[0].name).toBe('Apple');
    });
  });

  describe('malformed response — throws AIUnrecognizedFoodError', () => {
    it('throws when candidates is missing', () => {
      expect(() => parseGeminiResponse({})).toThrow(AIUnrecognizedFoodError);
    });

    it('throws when candidates is empty', () => {
      expect(() => parseGeminiResponse({ candidates: [] })).toThrow(
        AIUnrecognizedFoodError,
      );
    });

    it('throws when content.parts is missing', () => {
      const bad = { candidates: [{ content: {} }] };
      expect(() => parseGeminiResponse(bad)).toThrow(AIUnrecognizedFoodError);
    });

    it('throws when parts is empty', () => {
      const bad = { candidates: [{ content: { parts: [] } }] };
      expect(() => parseGeminiResponse(bad)).toThrow(AIUnrecognizedFoodError);
    });

    it('throws when inner JSON is invalid', () => {
      const bad = {
        candidates: [
          { content: { parts: [{ text: 'not-json{{' }] } },
        ],
      };
      expect(() => parseGeminiResponse(bad)).toThrow(AIUnrecognizedFoodError);
    });

    it('throws when inner JSON is missing total_calories', () => {
      const bad = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    total_protein: 0,
                    total_carbs: 0,
                    total_fat: 0,
                    food_items: [{ name: 'Apple', estimated_calories: 100, estimated_protein: 0, estimated_carbs: 25, estimated_fat: 0 }],
                  }),
                },
              ],
            },
          },
        ],
      };
      expect(() => parseGeminiResponse(bad)).toThrow(AIUnrecognizedFoodError);
    });

    it('throws when food_items is empty (invariant)', () => {
      const bad = {
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
      expect(() => parseGeminiResponse(bad)).toThrow(AIUnrecognizedFoodError);
    });

    it('throws when a food_item is missing its name', () => {
      const bad = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    total_calories: 100,
                    total_protein: 0,
                    total_carbs: 25,
                    total_fat: 0,
                    food_items: [
                      { estimated_calories: 100, estimated_protein: 0, estimated_carbs: 25, estimated_fat: 0 },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };
      expect(() => parseGeminiResponse(bad)).toThrow(AIUnrecognizedFoodError);
    });

    it('throws when a numeric field is negative', () => {
      const bad = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    total_calories: -100,
                    total_protein: 0,
                    total_carbs: 0,
                    total_fat: 0,
                    food_items: [{ name: 'X', estimated_calories: 0, estimated_protein: 0, estimated_carbs: 0, estimated_fat: 0 }],
                  }),
                },
              ],
            },
          },
        ],
      };
      expect(() => parseGeminiResponse(bad)).toThrow(AIUnrecognizedFoodError);
    });

    it('throws when given a non-object (string)', () => {
      expect(() => parseGeminiResponse('garbage')).toThrow(
        AIUnrecognizedFoodError,
      );
    });

    it('throws when given null', () => {
      expect(() => parseGeminiResponse(null)).toThrow(AIUnrecognizedFoodError);
    });
  });

  describe('markdown code block stripping', () => {
    it('strips ```json fences and parses the inner JSON', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n' + JSON.stringify({
                    total_calories: 400,
                    total_protein: 25,
                    total_carbs: 50,
                    total_fat: 10,
                    food_items: [
                      { name: 'Pasta', estimated_calories: 400, estimated_protein: 25, estimated_carbs: 50, estimated_fat: 10 },
                    ],
                  }) + '\n```',
                },
              ],
            },
          },
        ],
      };

      const result = parseGeminiResponse(geminiResponse);
      expect(result.total_calories).toBe(400);
      expect(result.food_items[0].name).toBe('Pasta');
    });

    it('strips ``` fences (no language tag) and parses the inner JSON', () => {
      const inner = JSON.stringify({
        total_calories: 200,
        total_protein: 10,
        total_carbs: 30,
        total_fat: 5,
        food_items: [
          { name: 'Salad', estimated_calories: 200, estimated_protein: 10, estimated_carbs: 30, estimated_fat: 5 },
        ],
      });
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: '```\n' + inner + '\n```' }],
            },
          },
        ],
      };

      const result = parseGeminiResponse(geminiResponse);
      expect(result.food_items).toHaveLength(1);
    });

    it('handles text before/after the code fence (extracts the fenced block)', () => {
      const inner = JSON.stringify({
        total_calories: 150,
        total_protein: 8,
        total_carbs: 20,
        total_fat: 3,
        food_items: [
          { name: 'Fruit', estimated_calories: 150, estimated_protein: 8, estimated_carbs: 20, estimated_fat: 3 },
        ],
      });
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Here is the analysis:\n```json\n' + inner + '\n```\nDone.' }],
            },
          },
        ],
      };

      const result = parseGeminiResponse(geminiResponse);
      expect(result.total_calories).toBe(150);
    });
  });

  describe('explicit error response', () => {
    it('throws AIUnrecognizedFoodError when response has {"error": "unrecognized"}', () => {
      const bad = {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ error: 'unrecognized' }) }],
            },
          },
        ],
      };
      expect(() => parseGeminiResponse(bad)).toThrow(AIUnrecognizedFoodError);
    });
  });
});