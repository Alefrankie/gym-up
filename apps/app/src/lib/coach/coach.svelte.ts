import { exerciseNameEs } from '@gym-up/contracts';
import { i18n } from '#lib/i18n';
import { nudge } from '#lib/nudge.svelte';
import { session } from '#lib/session';
import type { CoachEvent } from './lines';
import { pickLine, type CoachVars, type PickedLine } from './pick';
import { coachVoice } from './voice.svelte';

/** Lines of the same event not repeated while others are left. */
export const HISTORY = 10;

const historyKey = (event: CoachEvent) => `gymup.coach.recent.${event}`;

function readHistory(event: CoachEvent): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(historyKey(event)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function remember(event: CoachEvent, template: string) {
  try {
    const next = [template, ...readHistory(event).filter((t) => t !== template)].slice(0, HISTORY);
    localStorage.setItem(historyKey(event), JSON.stringify(next));
  } catch {
    /* private mode: no history, lines may repeat sooner */
  }
}

/**
 * A line for the event in the user's tone and address form, not one of the last ten said. `exercise` is the
 * exercise's stored (English) name: it is shown in the line's language.
 */
export function coachLine(event: CoachEvent, vars: CoachVars = {}): PickedLine | null {
  const tone = session.user?.coachTone ?? 'normal';
  const locale = tone === 'gymrat' ? 'es' : i18n.locale;
  const first = session.user?.displayName.split(' ')[0];
  const filled: CoachVars = { ...(first ? { name: first } : {}), ...vars };
  if (typeof vars.exercise === 'string') filled.exercise = (locale === 'es' && exerciseNameEs(vars.exercise)) || vars.exercise;
  const line = pickLine(event, {
    tone,
    addressForm: session.user?.addressForm ?? 'neutral',
    locale,
    vars: filled,
    recent: readHistory(event),
  });
  if (line) remember(event, line.template);
  return line;
}

/** Shows the Coach's line as a toast and says it aloud when the voice is on. */
export function coachSay(event: CoachEvent, vars: CoachVars = {}): PickedLine | null {
  const line = coachLine(event, vars);
  if (!line) return null;
  nudge.show(line.text, Math.min(6000, 2500 + line.text.length * 40));
  void coachVoice.speak(line.text, line.locale);
  return line;
}

/** Says the Home line once per app start (browsers may block speech before the first tap; then it stays silent). */
let homeSpoken = false;
export function speakHomeOnce(line: PickedLine | null) {
  if (!line || homeSpoken || !coachVoice.enabled) return;
  homeSpoken = true;
  void coachVoice.speak(line.text, line.locale);
}
