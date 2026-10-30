import type { LibraryExerciseDto } from '@gym-up/contracts';

/** The muscle groups people actually think in; the full taxonomy still applies to each exercise. */
export const FILTER_MUSCLES = [
  'chest',
  'upper_back',
  'lats',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abdominals',
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'lower_back',
  'cardio',
] as const;

export interface ExerciseFilter {
  q: string;
  /** Matches the primary or a secondary muscle; '' = any. */
  muscle: string;
  /** '' = any. */
  equipment: string;
}

export const emptyFilter = (): ExerciseFilter => ({ q: '', muscle: '', equipment: '' });

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** The catalog is small, so filtering happens on the phone: instant, and it works offline. */
export function filterExercises(items: readonly LibraryExerciseDto[], f: ExerciseFilter): LibraryExerciseDto[] {
  const q = norm(f.q.trim());
  return items.filter(
    (e) =>
      (!q || norm(e.name).includes(q)) &&
      (!f.muscle || e.primaryMuscle === f.muscle || e.secondaryMuscles.includes(f.muscle)) &&
      (!f.equipment || e.equipment === f.equipment),
  );
}
