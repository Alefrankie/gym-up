import { exerciseNameEs } from '@gym-up/contracts';
import { i18n } from '#lib/i18n';

/**
 * The name to show for an exercise in the current language. The API stores system exercises under their English
 * name; in Spanish they read from the shared translation table. Custom exercises keep the name their owner gave them.
 */
export const exerciseName = (name: string): string => (i18n.locale === 'es' && exerciseNameEs(name)) || name;
