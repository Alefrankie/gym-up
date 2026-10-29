// tests/nutrition/nutrition-page-helpers.test.ts
//
// Pure-helper tests for the nutrition page UI logic. These run under
// node (no DOM needed) — they cover the data transforms and the
// error-code → user-facing-message mapping that drive the components.
//
// Pinned strings match the values declared in
// docs/architecture/contexts/nutrition/flows/analyze-meal.flow.md
// (Failure modes section). Drift here = drift in the flow doc, which
// must be updated together.

// Default environment is node — explicit here for clarity.
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  mapAnalyzeErrorToMessage,
  recalculateTotals,
  applyFoodItemEdit,
  detectUserEdited,
} from '@/lib/contexts/nutrition/application/nutrition-page-helpers';
import type { FoodItem } from '@/lib/contexts/nutrition/domain/nutrition.types';

// ---------- fixtures -----------------------------------------------------

const SAMPLE_ITEM_A: FoodItem = {
  name: 'Grilled chicken',
  estimated_calories: 300,
  estimated_protein: 30,
  estimated_carbs: 0,
  estimated_fat: 8,
};

const SAMPLE_ITEM_B: FoodItem = {
  name: 'Brown rice',
  estimated_calories: 200,
  estimated_protein: 0,
  estimated_carbs: 60,
  estimated_fat: 7,
};

// ---------- error mapping ------------------------------------------------

describe('mapAnalyzeErrorToMessage', () => {
  it('returns pinned message for INVALID_INPUT + unsupported_format', () => {
    expect(mapAnalyzeErrorToMessage('INVALID_INPUT', 'unsupported_format')).toBe(
      'Unsupported format. Use jpg, png, or webp.',
    );
  });

  it('returns pinned message for INVALID_INPUT + size_exceeded', () => {
    expect(mapAnalyzeErrorToMessage('INVALID_INPUT', 'size_exceeded')).toBe(
      'Photo too large. Max 5MB.',
    );
  });

  it('returns a fallback message for INVALID_INPUT without reason', () => {
    const msg = mapAnalyzeErrorToMessage('INVALID_INPUT');
    expect(msg.length).toBeGreaterThan(0);
    // Not one of the pinned ones — must be a sensible fallback.
    expect(msg).not.toContain('Use jpg, png, or webp.');
    expect(msg).not.toContain('Max 5MB');
  });

  it('returns the pinned UNAUTHORIZED message (Spanish UX copy)', () => {
    expect(mapAnalyzeErrorToMessage('UNAUTHORIZED')).toBe(
      'Tu sesión expiró. Volvé a iniciar sesión.',
    );
  });

  it('returns the pinned AI_UNRECOGNIZED message (English flow copy)', () => {
    expect(mapAnalyzeErrorToMessage('AI_UNRECOGNIZED')).toBe(
      'Food not recognized. Try a clearer photo or better lighting.',
    );
  });

  it('returns the pinned AI_TIMEOUT message (English flow copy)', () => {
    expect(mapAnalyzeErrorToMessage('AI_TIMEOUT')).toBe(
      'Analysis took too long. Try again.',
    );
  });

  it('returns the pinned INTERNAL message', () => {
    expect(mapAnalyzeErrorToMessage('INTERNAL')).toBe(
      'No pudimos analizar la foto. Intentá de nuevo.',
    );
  });

  it('returns the pinned NETWORK message for fetch-level failures', () => {
    expect(mapAnalyzeErrorToMessage('NETWORK')).toBe(
      'Sin conexión. Verificá tu red e intentá de nuevo.',
    );
  });

  it('never returns an empty string for any known code', () => {
    const codes: Array<'INVALID_INPUT' | 'UNAUTHORIZED' | 'AI_UNRECOGNIZED' | 'AI_TIMEOUT' | 'INTERNAL' | 'NETWORK'> = [
      'INVALID_INPUT',
      'UNAUTHORIZED',
      'AI_UNRECOGNIZED',
      'AI_TIMEOUT',
      'INTERNAL',
      'NETWORK',
    ];
    for (const c of codes) {
      expect(mapAnalyzeErrorToMessage(c).length).toBeGreaterThan(0);
    }
  });
});

// ---------- totals recalculation -----------------------------------------

describe('recalculateTotals', () => {
  it('returns zeros for an empty list', () => {
    expect(recalculateTotals([])).toEqual({
      total_calories: 0,
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0,
    });
  });

  it('returns the item values for a single-item list', () => {
    expect(recalculateTotals([SAMPLE_ITEM_A])).toEqual({
      total_calories: 300,
      total_protein: 30,
      total_carbs: 0,
      total_fat: 8,
    });
  });

  it('sums every field across multiple items', () => {
    expect(recalculateTotals([SAMPLE_ITEM_A, SAMPLE_ITEM_B])).toEqual({
      total_calories: 500,
      total_protein: 30,
      total_carbs: 60,
      total_fat: 15,
    });
  });

  it('handles zero values without breaking the sum', () => {
    const zeroItem: FoodItem = {
      name: 'Water',
      estimated_calories: 0,
      estimated_protein: 0,
      estimated_carbs: 0,
      estimated_fat: 0,
    };
    expect(recalculateTotals([SAMPLE_ITEM_A, zeroItem])).toEqual({
      total_calories: 300,
      total_protein: 30,
      total_carbs: 0,
      total_fat: 8,
    });
  });

  it('returns a fresh object every call (no shared mutable state)', () => {
    const a = recalculateTotals([SAMPLE_ITEM_A]);
    const b = recalculateTotals([SAMPLE_ITEM_A]);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------- apply edit ---------------------------------------------------

describe('applyFoodItemEdit', () => {
  it('updates only the targeted index, preserving order', () => {
    const edits = { estimated_calories: 250, estimated_fat: 6 };
    const result = applyFoodItemEdit(
      [SAMPLE_ITEM_A, SAMPLE_ITEM_B],
      0,
      edits,
    );
    expect(result[0]).toEqual({
      ...SAMPLE_ITEM_A,
      estimated_calories: 250,
      estimated_fat: 6,
    });
    expect(result[1]).toBe(SAMPLE_ITEM_B);
  });

  it('returns a new array (does not mutate the original)', () => {
    const original = [SAMPLE_ITEM_A, SAMPLE_ITEM_B];
    const before = JSON.stringify(original);
    applyFoodItemEdit(original, 1, { name: 'White rice' });
    expect(JSON.stringify(original)).toBe(before);
  });

  it('returns a copy of the original when the index is out of range', () => {
    const original = [SAMPLE_ITEM_A, SAMPLE_ITEM_B];
    const result = applyFoodItemEdit(original, 99, { estimated_calories: 0 });
    expect(result).toEqual(original);
    expect(result).not.toBe(original);
  });

  it('allows editing the name field', () => {
    const result = applyFoodItemEdit(
      [SAMPLE_ITEM_A, SAMPLE_ITEM_B],
      1,
      { name: 'Quinoa' },
    );
    expect(result[1]?.name).toBe('Quinoa');
    // Other fields untouched
    expect(result[1]?.estimated_calories).toBe(SAMPLE_ITEM_B.estimated_calories);
  });

  it('allows a full replacement (all fields)', () => {
    const replacement: FoodItem = {
      name: 'Salad',
      estimated_calories: 100,
      estimated_protein: 5,
      estimated_carbs: 10,
      estimated_fat: 3,
    };
    const result = applyFoodItemEdit([SAMPLE_ITEM_A], 0, replacement);
    expect(result[0]).toEqual(replacement);
  });

  it('preserves original values when edits object is empty', () => {
    const result = applyFoodItemEdit([SAMPLE_ITEM_A], 0, {});
    expect(result[0]).toEqual(SAMPLE_ITEM_A);
  });
});

// ---------- user_edited detection ----------------------------------------

describe('detectUserEdited', () => {
  it('returns false when the lists are identical', () => {
    expect(detectUserEdited([SAMPLE_ITEM_A], [SAMPLE_ITEM_A])).toBe(false);
  });

  it('returns true when the lengths differ', () => {
    expect(
      detectUserEdited([SAMPLE_ITEM_A, SAMPLE_ITEM_B], [SAMPLE_ITEM_A]),
    ).toBe(true);
  });

  it('returns true when any field of any item changed', () => {
    expect(
      detectUserEdited(
        [{ ...SAMPLE_ITEM_A, estimated_calories: 250 }],
        [SAMPLE_ITEM_A],
      ),
    ).toBe(true);
  });

  it('returns true when the name was edited', () => {
    expect(
      detectUserEdited(
        [{ ...SAMPLE_ITEM_A, name: 'Boiled chicken' }],
        [SAMPLE_ITEM_A],
      ),
    ).toBe(true);
  });

  it('returns true when only one of three items changed', () => {
    expect(
      detectUserEdited(
        [SAMPLE_ITEM_A, { ...SAMPLE_ITEM_B, estimated_calories: 999 }, SAMPLE_ITEM_A],
        [SAMPLE_ITEM_A, SAMPLE_ITEM_B, SAMPLE_ITEM_A],
      ),
    ).toBe(true);
  });
});
