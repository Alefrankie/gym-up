import { describe, expect, it } from 'vitest';
import { dropWeight } from './workout-view.svelte';

describe('dropWeight', () => {
  it('is 25 % lighter, rounded to 2.5 kg', () => {
    expect(dropWeight(80, 'kg')).toBe(60);
    expect(dropWeight(60, 'kg')).toBe(45);
    expect(dropWeight(45, 'kg')).toBe(35);
  });

  it('rounds to 5 lbs for a lbs user', () => {
    expect(dropWeight(185, 'lbs')).toBe(140);
  });

  it('never goes below zero', () => {
    expect(dropWeight(0, 'kg')).toBe(0);
  });
});
