// Community (DR-0028): shared helpers for the feed, member profiles and workout cards.

import { dateLocale } from '#lib/i18n';
import { fetchBlob } from '#lib/api/binary';
import { session } from '#lib/session';
import { toDisplay } from '#lib/offline/workout-view.svelte';

/** Weight in the reader's unit; storage is always kg. */
export function weight(kg: number): string {
  const unit = session.user?.weightUnit ?? 'kg';
  return `${toDisplay(kg, unit).toLocaleString(dateLocale())} ${unit}`;
}

/** Large volumes read better rounded: 12 340 kg, not 12 337 kg. */
export function volume(kg: number): string {
  const unit = session.user?.weightUnit ?? 'kg';
  const v = toDisplay(kg, unit);
  const rounded = v >= 1000 ? Math.round(v / 10) * 10 : Math.round(v);
  return `${rounded.toLocaleString(dateLocale())} ${unit}`;
}

export const day = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(key + 'T00:00:00Z').toLocaleDateString(dateLocale(), { ...opts, timeZone: 'UTC' });

/** The viewer's local calendar day, so "this week" matches their wall calendar. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Shared photos need the bearer token, so they load as blobs. Object URLs are kept for the session.
const photoUrls = new Map<string, Promise<string>>();

export function photoUrl(workoutId: string): Promise<string> {
  let url = photoUrls.get(workoutId);
  if (!url) {
    url = fetchBlob(`/community/workouts/${workoutId}/photo`).then((b) => URL.createObjectURL(b));
    url.catch(() => photoUrls.delete(workoutId));
    photoUrls.set(workoutId, url);
  }
  return url;
}

export function forgetPhoto(workoutId: string): void {
  const url = photoUrls.get(workoutId);
  photoUrls.delete(workoutId);
  url?.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
}

const NOTICE_KEY = 'gymup.community.notice';
export function noticeSeen(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}
export function markNoticeSeen(): void {
  try {
    localStorage.setItem(NOTICE_KEY, '1');
  } catch {
    /* private mode: the notice simply shows again */
  }
}
