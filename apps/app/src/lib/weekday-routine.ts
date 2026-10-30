/**
 * Programs whose routines are named after weekdays ("Monday", "Lunes, pecho"…) are followed by the calendar:
 * on Friday you train Friday's routine. Programs with other names (Day A / Day B…) keep the rotation.
 */

const NAMES: Record<string, number> = {
  sunday: 0, domingo: 0,
  monday: 1, lunes: 1,
  tuesday: 2, martes: 2,
  wednesday: 3, miercoles: 3,
  thursday: 4, jueves: 4,
  friday: 5, viernes: 5,
  saturday: 6, sabado: 6,
};

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** 0 (Sunday) … 6 (Saturday) when the routine name starts with a weekday, else null. */
export function weekdayOf(name: string): number | null {
  const first = norm(name).match(/^[a-z]+/)?.[0];
  return first !== undefined && first in NAMES ? NAMES[first]! : null;
}

export type ByWeekday<R> = { today: R | null; next: R | null; nextWeekday: number | null };

/**
 * When every routine with exercises carries a weekday, returns today's routine (or null on a rest day)
 * and the next one coming up. Returns null for programs that are not organised by weekday.
 */
export function routineForDate<R extends { name: string; exercises: readonly unknown[] }>(routines: readonly R[], date: Date): ByWeekday<R> | null {
  const used = routines.filter((r) => r.exercises.length > 0);
  if (used.length === 0 || used.some((r) => weekdayOf(r.name) === null)) return null;
  const dow = date.getDay();
  const today = used.find((r) => weekdayOf(r.name) === dow) ?? null;
  for (let i = 1; i <= 7; i++) {
    const d = (dow + i) % 7;
    const next = used.find((r) => weekdayOf(r.name) === d);
    if (next) return { today, next, nextWeekday: d };
  }
  return { today, next: null, nextWeekday: null };
}
