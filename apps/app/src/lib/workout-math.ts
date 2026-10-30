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
