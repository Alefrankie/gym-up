import { t, type MessageKey } from '#lib/i18n';

/** Labels for the exercise taxonomy (ADR-017), resolved in the current language. The API stores and returns the English slugs. */
const MUSCLE_SLUGS = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'cardio',
  'chest',
  'forearms',
  'full_body',
  'glutes',
  'hamstrings',
  'lats',
  'lower_back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
  'upper_back',
  'other',
] as const;

const EQUIPMENT_SLUGS = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'] as const;

const TYPE_SLUGS = ['weight_reps', 'bodyweight_reps', 'duration', 'distance_duration'] as const;

/** A read-only map whose values are looked up in the current language each time they are read. */
function labelMap(slugs: readonly string[], prefix: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const slug of slugs) {
    Object.defineProperty(map, slug, { enumerable: true, get: () => t(`${prefix}.${slug}` as MessageKey) });
  }
  return map;
}

export const MUSCLE_LABELS = labelMap(MUSCLE_SLUGS, 'labels.muscle');
export const EQUIPMENT_LABELS = labelMap(EQUIPMENT_SLUGS, 'labels.equipment');
export const TYPE_LABELS = labelMap(TYPE_SLUGS, 'labels.type');

export const muscle = (slug: string): string => MUSCLE_LABELS[slug] ?? slug;
export const equipment = (slug: string): string => EQUIPMENT_LABELS[slug] ?? slug;
