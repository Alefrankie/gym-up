import type { AddressForm, CoachTone } from '@gym-up/contracts';
import { LINES, type CoachEvent, type CoachLocale, type Line, type TimeOfDay } from './lines';

/** Values the lines can drop in: `{exercise}`, `{weight}`, `{reps}`, `{restSeconds}`, `{name}`. */
export type CoachVars = Partial<Record<'exercise' | 'weight' | 'reps' | 'restSeconds' | 'name', string | number>>;

export interface PickOptions {
  tone: CoachTone;
  addressForm: AddressForm;
  /** App language. `gymrat` always speaks Spanish. */
  locale: CoachLocale;
  vars?: CoachVars;
  now?: Date;
  /** Templates said lately for this event; they are skipped while others are left. */
  recent?: readonly string[];
  random?: () => number;
}

export interface PickedLine {
  /** The catalog entry, before filling in names and gender (what the anti-repeat history keeps). */
  template: string;
  text: string;
  /** Language of the line, for the voice. */
  locale: CoachLocale;
  tone: CoachTone;
}

const VAR = /\{(\w+)\}/g;
// `{m|f|neutral}`: the words that agree with how the user wants to be addressed.
const GENDER = /\{([^{}|]*)\|([^{}|]*)\|([^{}|]*)\}/g;

export function timeOfDay(d: Date): TimeOfDay {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 20) return 'afternoon';
  return 'night';
}

export const lineText = (l: Line): string => (typeof l === 'string' ? l : l.text);

/** Names a line needs; it is only picked when all of them are known. */
export const lineVars = (text: string): string[] => [...text.replaceAll(GENDER, '').matchAll(VAR)].map((m) => m[1]!);

/** Fills in the gender words (exact form, else neutral) and the values. */
export function render(template: string, addressForm: AddressForm, vars: CoachVars = {}): string {
  const i = addressForm === 'm' ? 0 : addressForm === 'f' ? 1 : 2;
  return template
    .replaceAll(GENDER, (...m: string[]) => m[1 + i] || m[3] || m[1]!)
    .replaceAll(VAR, (whole, key: string) => {
      const v = vars[key as keyof CoachVars];
      return v === undefined ? whole : String(v);
    });
}

function eligible(l: Line, vars: CoachVars, time: TimeOfDay): boolean {
  if (typeof l !== 'string' && l.time !== time) return false;
  return lineVars(lineText(l)).every((k) => vars[k as keyof CoachVars] !== undefined && vars[k as keyof CoachVars] !== '');
}

/**
 * Where to look for a line, in order: the chosen tone in the app language, then `normal`, then Spanish.
 * `gymrat` only exists in Spanish, so it never falls back to English.
 */
export function lookupChain(tone: CoachTone, locale: CoachLocale): [CoachTone, CoachLocale][] {
  const chain: [CoachTone, CoachLocale][] =
    tone === 'gymrat' ? [['gymrat', 'es']] : [[tone, locale]];
  chain.push(['normal', locale], ['normal', 'es']);
  return chain;
}

/** A random line for the event, skipping the recent ones; null when the catalog has nothing usable. */
export function pickLine(event: CoachEvent, o: PickOptions): PickedLine | null {
  const vars = o.vars ?? {};
  const time = timeOfDay(o.now ?? new Date());
  const random = o.random ?? Math.random;
  const recent = new Set(o.recent ?? []);
  for (const [tone, locale] of lookupChain(o.tone, o.locale)) {
    const ok = (LINES[tone][locale]?.[event] ?? []).filter((l) => eligible(l, vars, time)).map(lineText);
    if (!ok.length) continue;
    const fresh = ok.filter((t) => !recent.has(t));
    const pool = fresh.length ? fresh : ok;
    const template = pool[Math.floor(random() * pool.length)]!;
    return { template, text: render(template, o.addressForm, vars), locale, tone };
  }
  return null;
}
