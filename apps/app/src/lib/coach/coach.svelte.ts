import { exerciseNameEs } from '@gym-up/contracts';
import { i18n } from '#lib/i18n';
import { nudge } from '#lib/nudge.svelte';
import { session } from '#lib/session';
import type { CoachEvent } from './lines';
import { pickLine, type CoachVars, type PickedLine } from './pick';
import { Limiter, speaksAloud } from './triggers';
import { coachCatalog } from './catalog.svelte';
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
  // Lines added or edited in the voice studio join the catalog as soon as they arrive (cached for offline).
  void coachCatalog.load();
  const tone = session.user?.coachTone ?? 'normal';
  const locale = tone === 'gymrat' ? 'es' : i18n.locale;
  const first = session.user?.displayName.split(' ')[0];
  const filled: CoachVars = { ...(first ? { name: first } : {}), ...vars };
  if (typeof vars.exercise === 'string') filled.exercise = (locale === 'es' && exerciseNameEs(vars.exercise)) || vars.exercise;
  const line = pickLine(event, {
    tone,
    addressForm: session.user?.addressForm ?? 'm',
    locale,
    vars: filled,
    recent: readHistory(event),
  });
  if (line) remember(event, line.template);
  return line;
}

// One line every ~20 s during a workout, so the Coach does not talk over itself (records, rest end and the like
// always get through).
const limiter = new Limiter();

/** Shows the Coach's line as a toast and says it aloud when the voice is on; null when the limiter holds it back. */
export function coachSay(event: CoachEvent, vars: CoachVars = {}): PickedLine | null {
  if (!limiter.allow(event)) return null;
  const line = coachLine(event, vars);
  if (line) coachAnnounce(line, { speak: speaksAloud(event) });
  return line;
}

/** Shows and says a line picked earlier (the rest-end line is chosen when the rest starts). */
export function coachAnnounce(line: PickedLine, opts: { speak?: boolean } = {}) {
  nudge.show(line.text, Math.min(6000, 2500 + line.text.length * 40));
  if (opts.speak !== false) void coachVoice.speak(line.text, line.locale);
}

/** Says a line the user asked to hear (the sample after answering "Sí" to the voice question on Home). */
export function speakSample(line: PickedLine | null) {
  if (line && coachVoice.enabled) void coachVoice.speak(line.text, line.locale);
}
