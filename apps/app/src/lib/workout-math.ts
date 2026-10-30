import { userSchema } from '@gym-up/contracts';
import { api } from '#lib/api/client';
import { session } from '#lib/session';
import { t, tn } from '#lib/i18n';

/** Planned sets of a list of routine exercises. */
export const totalSets = (exercises: readonly { targetSets: number }[]) => exercises.reduce((n, e) => n + e.targetSets, 0);

/**
 * Rough duration: each set is ~45 s of work plus its rest (90 s when the routine does not say),
 * rounded to 5 minutes. Good enough to plan the session, not a promise.
 */
export const estimateMinutes = (exercises: readonly { targetSets: number; restSeconds?: number | null }[]) =>
  Math.max(5, Math.round(exercises.reduce((n, e) => n + e.targetSets * ((e.restSeconds ?? 90) + 45), 0) / 300) * 5);

/** "≈ 45 min · 5 ejercicios · 20 series" */
export const sessionSummary = (exercises: readonly { targetSets: number; restSeconds?: number | null }[]) =>
  t('workout.summary', {
    min: estimateMinutes(exercises),
    exercises: tn('workout.exerciseCount', exercises.length),
    sets: tn('sets.count', totalSets(exercises)),
  });

const BODY_KEY = 'body-weight-kg';

/** Body weight for calorie estimates: the profile's (same on every device), else this device's last value, else 75 kg. */
export function bodyWeightKg(): number {
  const fromProfile = session.user?.bodyWeightKg;
  if (fromProfile) return fromProfile;
  try {
    return Number(localStorage.getItem(BODY_KEY)) || 75;
  } catch {
    return 75;
  }
}

/** Keeps a new body weight on the profile; offline it stays on this device until the next save works. */
export async function saveBodyWeightKg(kg: number) {
  try {
    localStorage.setItem(BODY_KEY, String(kg));
  } catch {
    /* private mode */
  }
  if (session.user?.bodyWeightKg === kg) return;
  try {
    await session.set(await api('/auth/me', { method: 'PATCH', body: { bodyWeightKg: kg }, schema: userSchema }));
  } catch {
    /* offline: the local value is used meanwhile */
  }
}

/** Weight training burns about 5 MET: kcal = MET × body kg × hours. An estimate, shown as one. */
export const estimateKcal = (seconds: number, kg = bodyWeightKg()) => Math.round(5 * kg * (seconds / 3600));

/** "0:50:15": hours, minutes and seconds, like a stopwatch. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** "3'30\"" */
export const formatRest = (seconds: number) => `${Math.floor(seconds / 60)}'${String(Math.round(seconds % 60)).padStart(2, '0')}"`;

/**
 * Average and median rest between ticked sets, from when each was ticked. Gaps over 15 min are a pause,
 * not rest, and are left out. Null when there are not enough timestamps (e.g. a workout from another device).
 */
export function restStats(doneAt: (number | undefined)[]): { avg: number; median: number } | null {
  const times = doneAt.filter((x): x is number => !!x).sort((a, b) => a - b);
  const gaps = times
    .slice(1)
    .map((x, i) => (x - times[i]!) / 1000)
    .filter((g) => g > 5 && g < 900)
    .sort((a, b) => a - b);
  if (gaps.length < 2) return null;
  const mid = Math.floor(gaps.length / 2);
  return {
    avg: gaps.reduce((n, g) => n + g, 0) / gaps.length,
    median: gaps.length % 2 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2,
  };
}
