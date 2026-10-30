import { supplementListResponseSchema, type SupplementListResponse } from '@gym-up/contracts';
import { cachedGet, updateCached } from '#lib/offline/cache';
import { sync } from '#lib/offline/sync.svelte';

export { localDay } from '#lib/dates';

export const supplementsPath = (day: string) => `/supplements?day=${day}`;

export function loadSupplements(day: string, onCached: (r: SupplementListResponse) => void) {
  return cachedGet(supplementsPath(day), supplementListResponseSchema, { onCached: (c) => onCached(c.data) });
}

const minusDay = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Consecutive days taken, counting back from `today` if taken today, else from yesterday (as the API does). */
function streakOf(days: string[], today: string): number {
  const on = new Set(days);
  let cursor = on.has(today) ? today : minusDay(today);
  let n = 0;
  while (on.has(cursor)) {
    n++;
    cursor = minusDay(cursor);
  }
  return n;
}

/**
 * The list with one supplement ticked or unticked on `day` (today by default, or a past day being filled in).
 * Pure, so the screen can paint it before anything is saved.
 */
export function withMark(list: SupplementListResponse, id: string, taken: boolean, day = list.day): SupplementListResponse {
  return {
    ...list,
    items: list.items.map((i) => {
      if (i.id !== id) return i;
      const days = taken ? [...new Set([...i.days, day])].sort() : i.days.filter((d) => d !== day);
      return { ...i, days, taken: days.includes(list.day), streak: streakOf(days, list.day) };
    }),
  };
}

/** Saves a tick on the phone and queues it for the server; call after painting `withMark`. */
export async function persistMark(next: SupplementListResponse, id: string, taken: boolean, day = next.day): Promise<void> {
  await updateCached<SupplementListResponse>(supplementsPath(next.day), () => next);
  await sync.enqueue({ type: 'mark-supplement', supplementId: id, day, taken });
}
