import type { AddressForm, CoachTone } from '@gym-up/contracts';
import { COACH_EVENTS, LINES, type CoachEvent, type CoachLocale } from './lines';
import { lineText, lineVars, render } from './pick';

/** One line to record in the voice studio, as it will be said (gender words already chosen). */
export interface StudioLine {
  tone: CoachTone;
  locale: CoachLocale;
  event: CoachEvent;
  /** The address form this rendering is for; null when the line reads the same for everyone. */
  form: AddressForm | null;
  text: string;
}

/** Voice slot of the studio recordings (room for a second voice later without clashing ids). */
export const STUDIO_SLOT = 'main';

const TONES: CoachTone[] = ['gymrat', 'flower', 'normal', 'hard'];
const FORMS: AddressForm[] = ['m', 'f'];
const GENDER = /\{[^{}|]*\|[^{}|]*\}/;

/**
 * Every line the Coach can say without filling in a name, weight or exercise, rendered once per address form when
 * the form changes the words. Spanish first, then by tone and event. Lines with values are left to the phone or cloud
 * voice: they cannot be recorded ahead.
 */
export function studioLines(): StudioLine[] {
  const out: StudioLine[] = [];
  const seen = new Set<string>();
  for (const locale of ['es', 'en'] as const) {
    for (const tone of TONES) {
      for (const event of COACH_EVENTS) {
        for (const l of LINES[tone][locale]?.[event] ?? []) {
          const template = lineText(l);
          if (lineVars(template).length) continue;
          const forms = GENDER.test(template) ? FORMS : [null];
          for (const form of forms) {
            const text = render(template, form ?? 'm');
            const key = `${tone}|${locale}|${event}|${text}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ tone, locale, event, form, text });
          }
        }
      }
    }
  }
  return out;
}

/** Stable id of a recording: the hash of the voice slot and the words, so the app finds it from the line it says. */
export async function recordingId(text: string, slot = STUDIO_SLOT): Promise<string> {
  const data = new TextEncoder().encode(`${slot}|${text.trim()}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...hash].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type VoiceSource = 'recording' | 'cloud' | 'phone';

/** Who says a line: a studio recording first, then the chosen cloud voice, then the phone's own voice. */
export function chooseSource(o: { recorded: boolean; cloudChosen: boolean; cloudAvailable: boolean }): VoiceSource {
  if (o.recorded) return 'recording';
  return o.cloudChosen && o.cloudAvailable ? 'cloud' : 'phone';
}
