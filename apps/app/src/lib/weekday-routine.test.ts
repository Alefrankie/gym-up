import { describe, expect, it } from 'vitest';
import { routineForDate, weekdayOf } from './weekday-routine';

const r = (name: string, n = 1) => ({ name, exercises: Array.from({ length: n }) });

describe('weekday routines', () => {
  it('reads the weekday at the start of a name, in English or Spanish', () => {
    expect(weekdayOf('Friday')).toBe(5);
    expect(weekdayOf('Miércoles, espalda')).toBe(3);
    expect(weekdayOf('Día 1')).toBeNull();
  });

  it('picks the routine for the date, or a rest day with the next one', () => {
    const week = [r('Monday'), r('Tuesday'), r('Wednesday'), r('Thursday'), r('Friday'), r('Día 6', 0)];
    const friday = new Date(2026, 9, 30);
    expect(routineForDate(week, friday)?.today?.name).toBe('Friday');
    const saturday = new Date(2026, 9, 31);
    expect(routineForDate(week, saturday)).toMatchObject({ today: null, next: { name: 'Monday' }, nextWeekday: 1 });
  });

  it('leaves programs without weekday names to the rotation', () => {
    expect(routineForDate([r('Día A'), r('Día B')], new Date(2026, 9, 30))).toBeNull();
  });
});
