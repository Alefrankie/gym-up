// src/lib/contexts/nutrition/application/parse-gemini-response.ts
//
// Pure-function parser: Gemini REST response (unknown shape) ->
// typed `AIAnalysisResult`. Throws `AIUnrecognizedFoodError` for ANY
// malformed input. No I/O, no network — unit-tested in isolation.
//
// Anti-pattern 9 target: this is the highest type-safety seam in the
// story. Every shape branch is asserted, every numeric field is
// re-checked for type + non-negative, and the invariant
// `food_items.length >= 1` is enforced.
//
// Gemini response shape (REST `generateContent`):
//   { candidates: [{ content: { parts: [{ text: "<json-string>" }] } }] }
//
// The inner JSON in `parts[0].text` is the model's structured output
// (it is itself JSON, encoded as a string inside the outer JSON).

import { AIUnrecognizedFoodError } from '../domain/errors';
import type { AIAnalysisResult, FoodItem } from '../domain/nutrition.types';

/**
 * Public entry point. Always returns a typed result or throws
 * `AIUnrecognizedFoodError` — never throws a generic Error.
 */
export function parseGeminiResponse(raw: unknown): AIAnalysisResult {
  const outer = extractOuter(raw);
  const text = extractText(outer);
  const inner = parseInnerJson(text);
  return validateAndCoerce(inner);
}

// ---------- Step 1: outer envelope --------------------------------------

interface OuterEnvelope {
  candidates: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>;
    };
  }>;
}

function extractOuter(raw: unknown): OuterEnvelope {
  if (raw === null || typeof raw !== 'object') {
    throw new AIUnrecognizedFoodError();
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.candidates) || obj.candidates.length === 0) {
    throw new AIUnrecognizedFoodError();
  }
  return obj as unknown as OuterEnvelope;
}

function extractText(outer: OuterEnvelope): string {
  const firstCandidate = outer.candidates[0];
  const parts = firstCandidate?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new AIUnrecognizedFoodError();
  }
  const firstText = parts[0]?.text;
  if (typeof firstText !== 'string' || firstText.length === 0) {
    throw new AIUnrecognizedFoodError();
  }
  return stripMarkdownCodeBlocks(firstText);
}

/**
 * Strip markdown code fences (```json...``` or ```...```) that Gemini
 * sometimes wraps around JSON responses. The parser needs raw JSON.
 * Handles: bare fences, fences with surrounding text, and plain JSON.
 */
function stripMarkdownCodeBlocks(text: string): string {
  const trimmed = text.trim();
  // Match a fenced code block anywhere in the text (may have surrounding text).
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

// ---------- Step 2: inner JSON parse -----------------------------------

function parseInnerJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AIUnrecognizedFoodError();
  }
}

// ---------- Step 3: shape validation -----------------------------------

function validateAndCoerce(value: unknown): AIAnalysisResult {
  if (value === null || typeof value !== 'object') {
    throw new AIUnrecognizedFoodError();
  }
  const obj = value as Record<string, unknown>;

  // Handle explicit "unrecognized" response from the model.
  if (obj.error === 'unrecognized') {
    throw new AIUnrecognizedFoodError();
  }

  const total_calories = requireNonNegativeNumber(obj.total_calories);
  const total_protein = requireNonNegativeNumber(obj.total_protein);
  const total_carbs = requireNonNegativeNumber(obj.total_carbs);
  const total_fat = requireNonNegativeNumber(obj.total_fat);
  const food_items = requireFoodItemsArray(obj.food_items);

  return {
    total_calories,
    total_protein,
    total_carbs,
    total_fat,
    food_items,
  };
}

function requireNonNegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AIUnrecognizedFoodError();
  }
  return value;
}

function requireFoodItemsArray(value: unknown): FoodItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AIUnrecognizedFoodError();
  }
  return value.map((item) => requireFoodItem(item));
}

function requireFoodItem(value: unknown): FoodItem {
  if (value === null || typeof value !== 'object') {
    throw new AIUnrecognizedFoodError();
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new AIUnrecognizedFoodError();
  }
  return {
    name: obj.name,
    estimated_calories: requireNonNegativeNumber(obj.estimated_calories),
    estimated_protein: requireNonNegativeNumber(obj.estimated_protein),
    estimated_carbs: requireNonNegativeNumber(obj.estimated_carbs),
    estimated_fat: requireNonNegativeNumber(obj.estimated_fat),
  };
}