import { EXERCISE_NAMES_ES, type LibraryExerciseDto } from '@gym-up/contracts';

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

/** Words people type for each muscle slug, in Spanish and English, so "pecho" or "piernas" find exercises. */
const MUSCLE_WORDS: Record<string, string> = {
  abdominals: 'abdominales abdomen abs core oblicuos abdominals',
  abductors: 'abductores abductors cadera',
  adductors: 'aductores adductors entrepierna',
  biceps: 'biceps brazo brazos arms',
  calves: 'gemelos pantorrillas chamorros calves',
  cardio: 'cardio aerobico resistencia',
  chest: 'pecho pectoral pectorales chest pecs',
  forearms: 'antebrazos antebrazo agarre forearms grip',
  full_body: 'cuerpo completo full body',
  glutes: 'gluteos gluteo pompas cola glutes',
  hamstrings: 'femorales isquiotibiales isquios pierna piernas hamstrings legs',
  lats: 'dorsales dorsal espalda back lats',
  lower_back: 'lumbares lumbar espalda baja lower back',
  neck: 'cuello neck',
  quadriceps: 'cuadriceps cuads pierna piernas quads legs',
  shoulders: 'hombros hombro deltoides delts shoulders',
  traps: 'trapecio trapecios traps',
  triceps: 'triceps brazo brazos arms',
  upper_back: 'espalda espalda alta romboides back',
};

const EQUIPMENT_WORDS: Record<string, string> = {
  barbell: 'barra barbell',
  dumbbell: 'mancuerna mancuernas dumbbell',
  machine: 'maquina machine',
  cable: 'polea poleas cable',
  bodyweight: 'peso corporal sin peso calistenia bodyweight',
  kettlebell: 'kettlebell pesa rusa',
  band: 'banda liga elastico band',
};

/** Words that carry no meaning in a search ("press de banca con barra" → press, banca, barra). */
const STOP = new Set(['de', 'del', 'con', 'en', 'la', 'el', 'los', 'las', 'a', 'al', 'y', 'para', 'the', 'with', 'on', 'and']);

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

/** Normalized words, with simple plurals folded ("flexiones" ~ "flexion", "curls" ~ "curl"). */
const words = (s: string) =>
  norm(s)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(stem);

function stem(w: string): string {
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/** Edit distance with an early exit once it passes `max`. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

/** How well one query word matches one indexed word: 0 = not at all. */
function wordScore(q: string, w: string): number {
  if (q === w) return 4;
  if (w.startsWith(q)) return q.length >= 2 ? 3 : 0;
  if (q.length >= 4 && w.includes(q)) return 2;
  const typos = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
  if (typos && within(q, w, typos)) return 1.5;
  return 0;
}

interface Indexed {
  /** Display and alias words: a match here counts in full. */
  names: string[];
  /** Muscle and equipment words: a match here counts less. */
  tags: string[];
  /** Each whole name (English, Spanish, aliases), normalized. */
  full: string[];
}

const cache = new WeakMap<LibraryExerciseDto, Indexed>();

function indexed(e: LibraryExerciseDto): Indexed {
  let ix = cache.get(e);
  if (!ix) {
    const es = EXERCISE_NAMES_ES[e.name] ?? [];
    const text = [e.name, ...es].join(' ');
    ix = {
      names: words(text),
      tags: words(
        [MUSCLE_WORDS[e.primaryMuscle] ?? e.primaryMuscle, ...e.secondaryMuscles.map((m) => m.replace('_', ' ')), EQUIPMENT_WORDS[e.equipment] ?? ''].join(
          ' ',
        ),
      ),
      full: [e.name, ...es].map(norm),
    };
    cache.set(e, ix);
  }
  return ix;
}

/** 0 = no match. Every query word must match a name, alias, muscle or equipment word. */
export function searchScore(e: LibraryExerciseDto, query: string): number {
  const qs = words(query);
  if (!qs.length) return 1;
  const ix = indexed(e);
  let total = 0;
  for (const q of qs) {
    let best = 0;
    for (const w of ix.names) best = Math.max(best, wordScore(q, w));
    for (const w of ix.tags) best = Math.max(best, wordScore(q, w) * 0.6);
    if (!best) return 0;
    total += best;
  }
  // The whole query as typed: an exact name beats a name that starts with it, which beats one that contains it.
  const phrase = norm(query);
  if (ix.full.includes(phrase)) total += 6;
  else if (ix.full.some((n) => n.startsWith(phrase))) total += 4;
  else if (ix.full.some((n) => n.includes(phrase))) total += 3;
  // Among equals, the shorter (more basic) exercise first: "Squat" before "Bulgarian Squat".
  return total - ix.full[0]!.length * 0.01;
}

/** Words a spoken command wraps around the exercise name ("ahora toca el ejercicio de sentadilla"). */
const SPOKEN_FILLER = new Set(['ejercicio', 'ejercicios', 'ahora', 'toca', 'hacer', 'hago', 'vamos', 'voy', 'por', 'favor', 'un', 'una', 'lo', 'le', 'que']);

/**
 * Folds Spanish spelling and the way Spanish speakers say English names, so speech-to-text slips still meet:
 * "banca/vanca", "jalón/halón", "sentadilla/sentadiya", "squat/escuat", "press/pres", "hip thrust/jip trust".
 */
function sound(w: string): string {
  return w
    .replace(/^es(?=[^aeiou])/, 's')
    .replace(/qu/g, 'k')
    .replace(/c(?=[aou]|$)/g, 'k')
    .replace(/c(?=[ei])/g, 's')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/w/g, 'u')
    .replace(/ll/g, 'y')
    .replace(/th/g, 't')
    .replace(/[hj]/g, '')
    .replace(/(.)\1+/g, '$1');
}

const spokenCache = new Map<string, string[][]>();

/** Each name of an exercise (English, Spanish, aliases) as folded words. */
function spokenNames(name: string): string[][] {
  let names = spokenCache.get(name);
  if (!names) {
    names = [name, ...(EXERCISE_NAMES_ES[name] ?? [])].map((n) => words(n).map(sound)).filter((n) => n.length);
    spokenCache.set(name, names);
  }
  return names;
}

/**
 * How well a spoken phrase names this exercise; 0 = it does not. More forgiving than the search box: speech adds
 * filler words and mishears letters, so half the spoken words and half the words of one name must meet.
 */
export function spokenNameScore(name: string, spoken: string): number {
  const qs = words(spoken)
    .filter((w) => !SPOKEN_FILLER.has(w))
    .map(sound);
  if (!qs.length) return 0;
  let best = 0;
  for (const ws of spokenNames(name)) {
    let total = 0;
    let heard = 0;
    const covered = new Set<number>();
    for (const q of qs) {
      let top = 0;
      let at = -1;
      ws.forEach((w, i) => {
        const s = wordScore(q, w);
        if (s > top) [top, at] = [s, i];
      });
      if (top) {
        total += top;
        heard++;
        covered.add(at);
      }
    }
    const said = heard / qs.length;
    const coverage = covered.size / ws.length;
    if (said < 0.5 || coverage < 0.5) continue;
    best = Math.max(best, total * said * (0.5 + 0.5 * coverage));
  }
  return best;
}

/**
 * The catalog is a few hundred items, so search runs on the phone: instant, and it works offline. Matches are
 * accent and typo tolerant, understand Spanish and English names and aliases, and come best first; with no query
 * they come in alphabetical order of `name(e)`, the name shown on screen.
 */
export function filterExercises(
  items: readonly LibraryExerciseDto[],
  f: ExerciseFilter,
  name: (e: LibraryExerciseDto) => string = (e) => e.name,
): LibraryExerciseDto[] {
  const scored: { e: LibraryExerciseDto; score: number; label: string }[] = [];
  for (const e of items) {
    if (f.muscle && e.primaryMuscle !== f.muscle && !e.secondaryMuscles.includes(f.muscle)) continue;
    if (f.equipment && e.equipment !== f.equipment) continue;
    const score = searchScore(e, f.q);
    if (score > 0) scored.push({ e, score, label: name(e) });
  }
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return scored.map((s) => s.e);
}
