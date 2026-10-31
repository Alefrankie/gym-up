/**
 * What the Coach may never say, shared by the built-in catalog's tests and the API (custom and edited lines).
 * Duro y gracioso sí; never slurs, attacks on anyone's sexuality, jokes about bodies or disability, threats, or
 * pushing through pain. Swearing only in gymrat. No emojis or long dashes: lines are read aloud.
 */

/** Whole words (accents ignored). */
export const COACH_BLOCKED_WORDS = [
  // racial and origin slurs
  'negro', 'negra', 'indio', 'india', 'sudaca', 'veneco', 'chino', 'nigger', 'spic',
  // sexuality
  'maricon', 'maricona', 'maricones', 'puto', 'joto', 'gay', 'fag', 'faggot', 'tortillera', 'homosexual', 'trolo',
  // disability
  'retrasado', 'retrasada', 'mongolico', 'mongolica', 'subnormal', 'invalido', 'invalida', 'tarado', 'tarada', 'autista',
  'retard', 'cripple', 'cojo', 'coja', 'manco', 'manca', 'lisiado',
  // bodies
  'gordo', 'gorda', 'gordito', 'gordita', 'obeso', 'obesa', 'panzon', 'panzona', 'barrigon', 'flaco', 'flaca', 'fofo',
  'fofa', 'lonjas', 'fat', 'chubby', 'skinny', 'fatty',
] as const;

/** Whole-word phrases, plus stems that match inside words ("lesionado", "injury"). */
export const COACH_BLOCKED_PHRASES = [
  // threats
  'te mato', 'te voy a matar', 'te parto', 'te reviento', 'te voy a pegar', 'ver las caras', 'kill you', 'beat you',
  // "marico" is only a friendly vocative: never a statement about someone's sexuality
  'eres marico', 'eres marica', 'es marico', 'como marico', 'de marico', 'pareces marico', 'pareces marica',
  // training through pain or injury
  'aunque duela', 'con dolor', 'ignora el dolor', 'sin dolor no', 'no pain', 'through the pain',
] as const;
export const COACH_BLOCKED_STEMS = ['lesion', 'injur'] as const;

/** Swearing and street slang: gymrat only. */
export const COACH_SWEAR_WORDS = [
  'coño', 'carajo', 'verga', 'vergación', 'joder', 'jodas', 'jodiendo', 'mierda', 'bolas', 'pendejo', 'pendeja', 'marico',
  'marica', 'mamagüevo', 'mariquera', 'mariqueras', 'güevón', 'güevona', 'pajúo', 'pajúa', 'mojón', 'cagando', 'fuck',
  'shit', 'damn',
] as const;

export const COACH_LINE_MAX_CHARS = 200;

export type CoachTextProblem =
  | { kind: 'empty' }
  | { kind: 'tooLong' }
  | { kind: 'tokens' }
  | { kind: 'emoji' }
  | { kind: 'dash' }
  | { kind: 'blocked'; word: string }
  | { kind: 'swearing'; word: string };

const plainWords = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').split(/[^\p{L}]+/u).filter(Boolean);
const rawWords = (s: string) => s.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

/**
 * Problems with a Coach line for a tone, empty when it can be said. `template` allows the catalog's own `{...}`
 * tokens (placeholders and gender words); lines typed in the studio may not use braces or bars.
 */
export function coachTextProblems(text: string, tone: string, opts: { template?: boolean } = {}): CoachTextProblem[] {
  const out: CoachTextProblem[] = [];
  const t = text.trim();
  if (!t) return [{ kind: 'empty' }];
  if (!opts.template && t.length > COACH_LINE_MAX_CHARS) out.push({ kind: 'tooLong' });
  if (!opts.template && /[{}|]/.test(t)) out.push({ kind: 'tokens' });
  if (/\p{Extended_Pictographic}/u.test(t)) out.push({ kind: 'emoji' });
  if (t.includes('—') || t.includes('–')) out.push({ kind: 'dash' });
  const w = plainWords(t);
  const flat = ` ${w.join(' ')} `;
  for (const bad of COACH_BLOCKED_WORDS) if (w.includes(bad)) out.push({ kind: 'blocked', word: bad });
  for (const bad of COACH_BLOCKED_PHRASES) if (flat.includes(` ${bad} `)) out.push({ kind: 'blocked', word: bad });
  for (const stem of COACH_BLOCKED_STEMS) if (flat.includes(stem)) out.push({ kind: 'blocked', word: stem });
  if (tone !== 'gymrat') {
    const r = rawWords(t);
    for (const bad of COACH_SWEAR_WORDS) if (r.includes(bad)) out.push({ kind: 'swearing', word: bad });
  }
  return out;
}

/** The moments the Coach speaks (kept in sync with the app's catalog). */
export const COACH_EVENT_NAMES = [
  'home', 'weightDrop', 'restLong', 'setDone', 'setDrop', 'progressUp', 'pr', 'restHalf', 'restEnd', 'finish',
] as const;
export type CoachEventName = (typeof COACH_EVENT_NAMES)[number];
