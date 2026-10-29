// src/lib/contexts/nutrition/application/nutrition-page-helpers.ts
//
// Pure helpers consumed by meal-photo-capture.astro and
// nutrition-result.astro. Every public function is side-effect free and
// fully unit-testable (no DOM / Astro runtime required).
//
// User-facing strings are pinned to the values declared in:
//   docs/architecture/contexts/nutrition/flows/analyze-meal.flow.md
// (Failure modes section + client notes). If a string must change, the
// flow doc must be updated in the same commit.

import type { FoodItem } from '../domain/nutrition.types';

// ---------- error-code → message mapping ---------------------------------
//
// The code values come from the endpoint's AnalyzeErrorResponse.code
// union. The `reason` parameter is an optional discriminator available
// on INVALID_INPUT errors from the server (see analyze-route-handler.ts).

export type AnalyzeCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'AI_UNRECOGNIZED'
  | 'AI_TIMEOUT'
  | 'INTERNAL'
  | 'NETWORK';

const ERROR_MESSAGES: Record<AnalyzeCode, string> = {
  INVALID_INPUT: 'No pudimos analizar la foto. Intentá de nuevo.',
  UNAUTHORIZED: 'Tu sesión expiró. Volvé a iniciar sesión.',
  AI_UNRECOGNIZED:
    'Food not recognized. Try a clearer photo or better lighting.',
  AI_TIMEOUT: 'Analysis took too long. Try again.',
  INTERNAL: 'No pudimos analizar la foto. Intentá de nuevo.',
  NETWORK: 'Sin conexión. Verificá tu red e intentá de nuevo.',
};

/**
 * Map an `AnalyzeErrorResponse.code` (and optional server `reason`) to
 * a user-facing, UI-ready message string. The mapping is deterministic
 * and pinned to the analyze-meal flow document.
 */
export function mapAnalyzeErrorToMessage(
  code: AnalyzeCode,
  reason?: string,
): string {
  if (code === 'INVALID_INPUT') {
    if (reason === 'unsupported_format') {
      return 'Unsupported format. Use jpg, png, or webp.';
    }
    if (reason === 'size_exceeded') {
      return 'Photo too large. Max 5MB.';
    }
    return ERROR_MESSAGES[code];
  }
  return ERROR_MESSAGES[code];
}

// ---------- totals recalculation -----------------------------------------

export interface Totals {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

/**
 * Sum every numeric field across `items`. Returns a fresh object each
 * call — never shared mutable state.
 */
export function recalculateTotals(items: FoodItem[]): Totals {
  let total_calories = 0;
  let total_protein = 0;
  let total_carbs = 0;
  let total_fat = 0;

  for (const item of items) {
    total_calories += item.estimated_calories;
    total_protein += item.estimated_protein;
    total_carbs += item.estimated_carbs;
    total_fat += item.estimated_fat;
  }

  return { total_calories, total_protein, total_carbs, total_fat };
}

// ---------- per-item edit ------------------------------------------------

/**
 * Return a new list identical to `items` except for `index`, which has
 * been shallow-merged with `edits`. If `index` is out of range, a copy
 * of the original list is returned. The original list is never mutated.
 */
export function applyFoodItemEdit(
  items: FoodItem[],
  index: number,
  edits: Partial<FoodItem>,
): FoodItem[] {
  if (index < 0 || index >= items.length) {
    return [...items];
  }
  return items.map((item, i) =>
    i === index ? { ...item, ...edits } : item,
  );
}

// ---------- user_edited detection ----------------------------------------

/**
 * Compare two `FoodItem` arrays element-wise. Returns `true` as soon
 * as any field of any item differs (including name). Order-sensitive:
 * `[A, B]` vs `[A, C]` is edited; `[B, A]` vs `[A, B]` is edited.
 */
export function detectUserEdited(
  current: FoodItem[],
  original: FoodItem[],
): boolean {
  if (current.length !== original.length) return true;
  return current.some(
    (item, i) =>
      item.estimated_calories !== original[i]?.estimated_calories ||
      item.estimated_protein !== original[i]?.estimated_protein ||
      item.estimated_carbs !== original[i]?.estimated_carbs ||
      item.estimated_fat !== original[i]?.estimated_fat ||
      item.name !== original[i]?.name,
  );
}
