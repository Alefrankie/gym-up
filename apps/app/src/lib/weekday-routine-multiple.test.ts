import { describe, expect, it } from 'vitest';
import { routineForDate } from './weekday-routine';

describe('multiple weekday assignments', () => {
  const upper = { name: 'Upper', weekdays: [1, 3, 5], exercises: [{}] };
  const lower = { name: 'Lower', weekdays: [3], exercises: [{}] };

  it('returns every overlapping routine without duplicating the routine', () => {
    expect(routineForDate([upper, lower], new Date(2026, 10, 4))?.matches).toEqual([upper, lower]);
    expect(routineForDate([upper, lower], new Date(2026, 10, 6))?.matches).toEqual([upper]);
  });

  it('keeps the single-routine compatibility result and rest-day lookup', () => {
    expect(routineForDate([upper], new Date(2026, 10, 6))?.today).toBe(upper);
    expect(routineForDate([upper], new Date(2026, 10, 7))).toMatchObject({ today: null, matches: [], next: upper, nextWeekday: 1 });
  });

  it('reads legacy offline assignments', () => {
    const legacy = { name: 'Upper', weekday: 3, exercises: [{}] };
    expect(routineForDate([legacy], new Date(2026, 10, 4))?.matches).toEqual([legacy]);
  });

  it('leaves unscheduled programs in rotation', () => {
    expect(routineForDate([{ name: 'Upper', weekdays: [], exercises: [{}] }], new Date(2026, 10, 4))).toBeNull();
  });
});
