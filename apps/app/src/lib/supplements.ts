import { supplementListResponseSchema, type SupplementListResponse } from '@gym-up/contracts';
import { cachedGet, updateCached } from '#lib/offline/cache';
import { sync } from '#lib/offline/sync.svelte';
import { cancelCreatineReminder, scheduleCreatineReminder } from '#lib/notify';
import { localDay } from '#lib/dates';
import { writable } from 'svelte/store';
import type { Command } from '#lib/offline/outbox';

export { localDay } from '#lib/dates';

export const supplementsPath = (day: string) => `/supplements?day=${day}`;
export const CREATINE_REMINDER_KEY = 'gym-up:creatine-reminder';
export const creatineReminderError = writable(false);
type SupplementMark = Extract<Command, { type: 'mark-supplement' }>;
const activeLoads = new Set<Map<string, SupplementMark>>();
const markKey = (mark: SupplementMark) => `${mark.supplementId}:${mark.day}`;
let reminderRefreshGeneration = 0;

async function refreshCreatineReminder(response: SupplementListResponse): Promise<void> {
  if (typeof localStorage === 'undefined' || localStorage.getItem(CREATINE_REMINDER_KEY) !== 'on') return;
  const generation = ++reminderRefreshGeneration;
  const creatine = response.items.find((item) => /creatina|creatine/i.test(item.name));
  if (!creatine) {
    const cancelled = await cancelCreatineReminder();
    if (generation !== reminderRefreshGeneration) return;
    creatineReminderError.set(!cancelled);
    if (cancelled) localStorage.removeItem(CREATINE_REMINDER_KEY);
    return;
  }
  const scheduled = await scheduleCreatineReminder(creatine.days.includes(localDay()));
  if (generation === reminderRefreshGeneration) creatineReminderError.set(!scheduled);
}

export async function loadSupplements(day: string, onCached: (r: SupplementListResponse) => void) {
  const marks = new Map<string, SupplementMark>();
  activeLoads.add(marks);
  try {
    // A GET can finish after an offline mark has already synced. Keep the commands that were
    // pending when this read started, plus any taps made while it was in flight.
    for (const { command } of await sync.outbox.items()) {
      if (command.type === 'mark-supplement' && !marks.has(markKey(command))) marks.set(markKey(command), command);
    }
    const merge = (response: SupplementListResponse) => [...marks.values()].reduce(
      (next, mark) => withMark(next, mark.supplementId, mark.taken, mark.day), response,
    );
    const result = await cachedGet(supplementsPath(day), supplementListResponseSchema, { onCached: (c) => {
      const data = merge(c.data);
      onCached(data);
      // Dashboard and offline starts renew the schedule too, without waiting for the network.
      void refreshCreatineReminder(data);
    } });
    const data = merge(result.data);
    void refreshCreatineReminder(data);
    return { ...result, data };
  } finally {
    activeLoads.delete(marks);
  }
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
  const command: SupplementMark = { type: 'mark-supplement', supplementId: id, day, taken };
  for (const marks of activeLoads) marks.set(markKey(command), command);
  if (day === localDay() && next.items.some((item) => item.id === id && /creatina|creatine/i.test(item.name))) {
    void refreshCreatineReminder(next);
  }
  await updateCached<SupplementListResponse>(supplementsPath(next.day), () => next);
  await sync.enqueue(command);
}
