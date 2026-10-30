// The system exercise catalog: valid taxonomy, unique names, and a Spanish name for every exercise.

import { describe, expect, it } from 'vitest';
import { EQUIPMENT, EXERCISE_NAMES_ES, EXERCISE_TYPES, MUSCLE_GROUPS } from '@gym-up/contracts';
import { EXERCISE_CATALOG } from '../../db/catalog';

describe('exercise catalog', () => {
  it('has a few hundred exercises with unique names', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(300);
    const names = EXERCISE_CATALOG.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only the shared taxonomy', () => {
    for (const e of EXERCISE_CATALOG) {
      expect(MUSCLE_GROUPS, e.name).toContain(e.primary);
      for (const m of e.secondary) expect(MUSCLE_GROUPS, e.name).toContain(m);
      expect(EQUIPMENT, e.name).toContain(e.equipment);
      expect(EXERCISE_TYPES, e.name).toContain(e.type);
      expect(e.name.length, e.name).toBeLessThanOrEqual(60);
    }
  });

  it('has a Spanish name for every exercise and no orphan translations', () => {
    const catalog = new Set(EXERCISE_CATALOG.map((e) => e.name));
    expect(EXERCISE_CATALOG.filter((e) => !EXERCISE_NAMES_ES[e.name]).map((e) => e.name)).toEqual([]);
    expect(Object.keys(EXERCISE_NAMES_ES).filter((n) => !catalog.has(n))).toEqual([]);
  });
});
