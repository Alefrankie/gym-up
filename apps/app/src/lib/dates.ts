/** Dates as people say them, in Spanish, on the phone's own calendar. */

const fromDay = (ymd: string) => new Date(`${ymd}T12:00:00`);

/** "jueves, 29 de octubre" */
export const longDate = (d = new Date()) => d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

/** "29 oct" */
export const shortDay = (ymd: string) => fromDay(ymd).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');

/** "Hoy", "Ayer", "lun 27 oct" */
export function relativeDay(ymd: string, today: string): string {
  const diff = Math.round((fromDay(today).getTime() - fromDay(ymd).getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return fromDay(ymd).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replaceAll('.', '');
}
