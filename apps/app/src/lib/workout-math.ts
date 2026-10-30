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

/** Body weight used for calorie estimates, remembered on this device (75 kg until set). */
export function bodyWeightKg(): number {
  try {
    return Number(localStorage.getItem(BODY_KEY)) || 75;
  } catch {
    return 75;
  }
}

export function saveBodyWeightKg(kg: number) {
  try {
    localStorage.setItem(BODY_KEY, String(kg));
  } catch {
    /* private mode: the default stays */
  }
}

/** Weight training burns about 5 MET: kcal = MET × body kg × hours. An estimate, shown as one. */
export const estimateKcal = (seconds: number, kg = bodyWeightKg()) => Math.round(5 * kg * (seconds / 3600));

/** "1 h 20 min" / "45 min" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? t('finish.hm', { h, m }) : t('finish.m', { m });
}
