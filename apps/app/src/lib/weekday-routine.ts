/**
 * Programs whose routines have a planned weekday are followed by the calendar: on Friday you train Friday's
 * routine. The weekday is set when the program is built; older routines named after a weekday ("Monday",
 * "Lunes, pecho"…) count too. Programs without days keep the rotation.
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

export type ByWeekday<R> = { today: R | null; matches: R[]; next: R | null; nextWeekday: number | null };

/**
 * When every routine with exercises carries weekday assignments, returns all of today's routines (or an empty list on a rest day)
 * and the next one coming up. Returns null for programs that are not organised by weekday.
 */
export function routineForDate<R extends { name: string; weekday?: number | null; weekdays?: readonly number[]; exercises: readonly unknown[] }>(
  routines: readonly R[],
  date: Date,
): ByWeekday<R> | null {
  const used = routines.filter((r) => r.exercises.length > 0);
  const daysOf = (r: R) => r.weekdays ?? (r.weekday === null || r.weekday === undefined ? [] : [r.weekday]);
  // Explicit assignments win; old cached data may still carry just `weekday` or a weekday in its name.
  const anySet = used.some((r) => daysOf(r).length > 0);
  const planned = anySet ? used.filter((r) => daysOf(r).length > 0) : used;
  if (planned.length === 0 || (!anySet && planned.some((r) => weekdayOf(r.name) === null))) return null;
  const matches = (r: R, day: number) => anySet ? daysOf(r).includes(day) : weekdayOf(r.name) === day;
  const dow = date.getDay();
  const todaysRoutines = planned.filter((r) => matches(r, dow));
  const today = todaysRoutines[0] ?? null;
  for (let i = 1; i <= 7; i++) {
    const d = (dow + i) % 7;
    const next = planned.find((r) => matches(r, d));
    if (next) return { today, matches: todaysRoutines, next, nextWeekday: d };
  }
  return { today, matches: todaysRoutines, next: null, nextWeekday: null };
}
