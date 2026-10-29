import { supplementListResponseSchema, type SupplementListResponse } from '@gym-up/contracts';
import { cachedGet, updateCached } from '#lib/offline/cache';
import { sync } from '#lib/offline/sync.svelte';

export { localDay } from '#lib/dates';

export const supplementsPath = (day: string) => `/supplements?day=${day}`;

export function loadSupplements(day: string, onCached: (r: SupplementListResponse) => void) {
  return cachedGet(supplementsPath(day), supplementListResponseSchema, { onCached: (c) => onCached(c.data) });
}

/** The list with one supplement ticked or unticked. Pure, so the screen can paint it before anything is saved. */
export function withMark(list: SupplementListResponse, id: string, taken: boolean): SupplementListResponse {
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
  return next;
}

/** Saves a tick on the phone and queues it for the server; call after painting `withMark`. */
export async function persistMark(next: SupplementListResponse, id: string, taken: boolean): Promise<void> {
  await updateCached<SupplementListResponse>(supplementsPath(next.day), () => next);
  await sync.enqueue({ type: 'mark-supplement', supplementId: id, day: next.day, taken });
}
