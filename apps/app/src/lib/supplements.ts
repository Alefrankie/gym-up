import { supplementListResponseSchema, type SupplementListResponse } from '@gym-up/contracts';
import { cachedGet, updateCached } from '#lib/offline/cache';
import { sync } from '#lib/offline/sync.svelte';

/** Today on the phone's own calendar (not UTC): a supplement taken at 23:30 counts for today. */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const supplementsPath = (day: string) => `/supplements?day=${day}`;

export function loadSupplements(day: string, onCached: (r: SupplementListResponse) => void) {
  return cachedGet(supplementsPath(day), supplementListResponseSchema, { onCached: (c) => onCached(c.data) });
}

/** Ticks or unticks at once on the phone; the server hears about it when there is signal. */
export async function markSupplement(list: SupplementListResponse, id: string, taken: boolean): Promise<SupplementListResponse> {
  const next: SupplementListResponse = {
    ...list,
    items: list.items.map((i) => {
      if (i.id !== id) return i;
      const days = taken ? [...new Set([...i.days, list.day])].sort() : i.days.filter((d) => d !== list.day);
      // The streak counts back from today when ticked, from yesterday when not.
      const streak = taken ? i.streak + (i.taken ? 0 : 1) : Math.max(0, i.streak - (i.taken ? 1 : 0));
      return { ...i, taken, days, streak };
    }),
  };
  await updateCached<SupplementListResponse>(supplementsPath(list.day), () => next);
  await sync.enqueue({ type: 'mark-supplement', supplementId: id, day: list.day, taken });
  return next;
}
