import { describe, expect, it } from 'vitest';
import type { CoachTone } from '@gym-up/contracts';
import { COACH_EVENTS, LINES, type CoachLocale, type Line } from './lines';
import { lineText, lineVars, lookupChain, pickLine, render, timeOfDay } from './pick';
import { pickMaleVoice } from './male-voice';

const TONES: CoachTone[] = ['flower', 'normal', 'hard', 'gymrat'];
const all = (): { tone: CoachTone; locale: CoachLocale; text: string }[] =>
  TONES.flatMap((tone) =>
    (Object.entries(LINES[tone]) as [CoachLocale, Record<string, Line[]>][]).flatMap(([locale, events]) =>
      Object.values(events).flatMap((lines) => lines.map((l) => ({ tone, locale, text: lineText(l) }))),
    ),
  );
const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').split(/[^\p{L}]+/u).filter(Boolean);
const noon = new Date(2026, 9, 30, 13, 0);

describe('coach catalog', () => {
  it('has at least 25 Spanish lines per tone and event, 40 for gymrat', () => {
    for (const tone of TONES) {
      for (const event of COACH_EVENTS) {
        const n = LINES[tone].es?.[event].length ?? 0;
        expect(n, `${tone}/${event}`).toBeGreaterThanOrEqual(tone === 'gymrat' ? 40 : 25);
      }
    }
  });

  it('has English lines for every tone and event except gymrat, which is Spanish only', () => {
    expect(LINES.gymrat.en).toBeUndefined();
    for (const tone of TONES.filter((t) => t !== 'gymrat')) {
      for (const event of COACH_EVENTS) expect(LINES[tone].en?.[event].length ?? 0, `${tone}/${event}`).toBeGreaterThanOrEqual(10);
    }
  });

  it('always has more than ten lines that need no value, so the anti-repeat never runs dry', () => {
    for (const tone of TONES) {
      for (const event of COACH_EVENTS) {
        const plain = (LINES[tone].es?.[event] ?? []).filter((l) => typeof l === 'string' && !lineVars(l).length);
        expect(plain.length, `${tone}/${event}`).toBeGreaterThan(10);
      }
    }
  });

  it('has no duplicates within a tone and event', () => {
    for (const tone of TONES) {
      for (const [locale, events] of Object.entries(LINES[tone])) {
        for (const [event, lines] of Object.entries(events)) {
          const texts = lines.map(lineText);
          expect(new Set(texts).size, `${tone}/${locale}/${event}`).toBe(texts.length);
        }
      }
    }
  });

  it('only uses known placeholders and complete gender forms', () => {
    const known = new Set(['exercise', 'weight', 'reps', 'restSeconds', 'name']);
    for (const { text } of all()) {
      for (const v of lineVars(text)) expect(known.has(v), text).toBe(true);
      for (const m of text.matchAll(/\{([^{}]*\|[^{}]*)\}/g)) {
        const parts = m[1]!.split('|');
        expect(parts.length, text).toBe(3);
        expect(parts.every((p) => p.trim().length > 0), text).toBe(true);
      }
    }
  });

  it('is read aloud: no emojis and no long dashes', () => {
    for (const { text } of all()) {
      expect(/\p{Extended_Pictographic}/u.test(text), text).toBe(false);
      expect(text.includes('—') || text.includes('–'), text).toBe(false);
    }
  });

  it('never says slurs, body or disability jokes, threats, or to train through pain', () => {
    const words_ = [
      // racial and origin slurs
      'negro', 'negra', 'indio', 'india', 'sudaca', 'veneco', 'chino', 'nigger', 'spic',
      // sexuality
      'maricon', 'maricona', 'maricones', 'puto', 'joto', 'gay', 'fag', 'faggot', 'tortillera', 'homosexual', 'trolo',
      // disability
      'retrasado', 'retrasada', 'mongolico', 'mongolica', 'subnormal', 'invalido', 'invalida', 'tarado', 'tarada', 'autista', 'retard', 'cripple', 'cojo', 'coja', 'manco', 'manca', 'lisiado',
      // bodies
      'gordo', 'gorda', 'gordito', 'gordita', 'obeso', 'obesa', 'panzon', 'panzona', 'barrigon', 'flaco', 'flaca', 'fofo', 'fofa', 'lonjas', 'fat', 'chubby', 'skinny', 'fatty',
    ];
    // Word stems match anywhere ("lesionado", "injury"); phrases match whole words.
    const STEMS = new Set(['lesion', 'injur']);
    const phrases = [
      // threats
      'te mato', 'te voy a matar', 'te parto', 'te reviento', 'te voy a pegar', 'ver las caras', 'kill you', 'beat you',
      // "marico" is only a friendly vocative: never a statement about someone's sexuality
      'eres marico', 'eres marica', 'es marico', 'como marico', 'de marico', 'pareces marico', 'pareces marica',
      // training through pain or injury
      'aunque duela', 'con dolor', 'ignora el dolor', 'sin dolor no', 'lesion', 'no pain', 'through the pain', 'injur',
    ];
    for (const { text } of all()) {
      const w = words(text);
      const flat = ` ${w.join(' ')} `;
      for (const bad of words_) expect(w.includes(bad), `"${bad}" in: ${text}`).toBe(false);
      for (const bad of phrases) expect(STEMS.has(bad) ? flat.includes(bad) : flat.includes(` ${bad} `), `"${bad}" in: ${text}`).toBe(false);
    }
  });

  it('keeps gymrat street: most of its lines swear or use Venezuelan slang', () => {
    const street = /(coño|carajo|verga|vergación|mierda|bolas|pendej\w*|marico|marica|mamagüevo|mariquera\w*|güevón|güevona|pajúo|pajúa|ladilla|vaina|chamo|chama|pana|épale|na’ guará|becerr[oa]|mojón|jod\w+|flojo|floja|flojera)/iu;
    for (const event of COACH_EVENTS) {
      const lines = LINES.gymrat.es![event].map(lineText);
      const share = lines.filter((l) => street.test(l)).length / lines.length;
      expect(share, event).toBeGreaterThan(0.6);
    }
  });

  it('keeps swearing and street slang to gymrat', () => {
    const swear = [
      'coño', 'carajo', 'verga', 'vergación', 'joder', 'jodas', 'jodiendo', 'mierda', 'bolas', 'pendejo', 'pendeja', 'marico', 'marica',
      'mamagüevo', 'mariquera', 'mariqueras', 'güevón', 'güevona', 'pajúo', 'pajúa', 'mojón', 'cagando', 'fuck', 'shit', 'damn',
    ];
    for (const { tone, text } of all().filter((l) => l.tone !== 'gymrat')) {
      const w = text.toLowerCase().split(/[^\p{L}]+/u);
      for (const bad of swear) expect(w.includes(bad), `"${bad}" in ${tone}: ${text}`).toBe(false);
    }
  });
});

describe('render', () => {
  it('picks the address form, falling back to neutral', () => {
    const tpl = 'Estás {cansado|cansada|sin energía}.';
    expect(render(tpl, 'm')).toBe('Estás cansado.');
    expect(render(tpl, 'f')).toBe('Estás cansada.');
    expect(render(tpl, 'neutral')).toBe('Estás sin energía.');
    expect(render('Hola {chamo||pana}', 'f')).toBe('Hola pana');
  });

  it('fills in values', () => {
    expect(render('{exercise} con {weight}, {name}', 'neutral', { exercise: 'Sentadilla', weight: '40 kg', name: 'Ana' })).toBe('Sentadilla con 40 kg, Ana');
  });
});

describe('pickLine', () => {
  const base = { addressForm: 'neutral' as const, locale: 'es' as const, now: noon };

  it('picks from the chosen tone and event', () => {
    for (const tone of TONES) {
      for (const event of COACH_EVENTS) {
        const line = pickLine(event, { ...base, tone });
        expect(line?.tone, `${tone}/${event}`).toBe(tone);
        expect(LINES[tone].es![event].map(lineText)).toContain(line!.template);
      }
    }
  });

  it('skips lines that need values nobody passed, and fills the ones it can', () => {
    for (let i = 0; i < 200; i++) {
      const line = pickLine('weightDrop', { ...base, tone: 'gymrat', random: () => i / 200 });
      expect(line!.text).not.toMatch(/\{\w+\}/);
    }
    const withVars = new Set<string>();
    for (let i = 0; i < 200; i++) withVars.add(pickLine('weightDrop', { ...base, tone: 'gymrat', vars: { weight: '20 kg', exercise: 'Curl' }, random: () => i / 200 })!.text);
    expect([...withVars].some((t) => t.includes('20 kg'))).toBe(true);
  });

  it('only uses time-of-day lines at that time', () => {
    const morning = new Date(2026, 9, 30, 8, 0);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(pickLine('home', { ...base, tone: 'flower', now: noon, random: () => i / 400 })!.template);
    expect(seen.has('Buenos días, mi amor. Que el sol te dé fuerza hoy.')).toBe(false);
    const am = new Set<string>();
    for (let i = 0; i < 400; i++) am.add(pickLine('home', { ...base, tone: 'flower', now: morning, random: () => i / 400 })!.template);
    expect(am.has('Buenos días, mi amor. Que el sol te dé fuerza hoy.')).toBe(true);
    expect(timeOfDay(new Date(2026, 9, 30, 2, 0))).toBe('night');
  });

  it('does not repeat the last ten lines of the event', () => {
    const recent: string[] = [];
    for (let i = 0; i < 60; i++) {
      const line = pickLine('restLong', { ...base, tone: 'hard', recent: recent.slice(0, 10) })!;
      expect(recent.slice(0, 10)).not.toContain(line.template);
      recent.unshift(line.template);
    }
  });

  it('repeats rather than going silent when every line was said lately', () => {
    const every = LINES.normal.es!.restLong.map(lineText);
    expect(pickLine('restLong', { ...base, tone: 'normal', recent: every })).not.toBeNull();
  });

  it('speaks gymrat in Spanish even when the app is in English', () => {
    const line = pickLine('home', { ...base, tone: 'gymrat', locale: 'en' })!;
    expect(line.locale).toBe('es');
    expect(line.tone).toBe('gymrat');
  });

  it('uses English for the other tones when the app is in English', () => {
    for (const tone of TONES.filter((t) => t !== 'gymrat')) expect(pickLine('home', { ...base, tone, locale: 'en' })!.locale).toBe('en');
  });

  it('falls back to normal, then Spanish', () => {
    expect(lookupChain('flower', 'en')).toEqual([['flower', 'en'], ['normal', 'en'], ['normal', 'es']]);
    expect(lookupChain('gymrat', 'en')).toEqual([['gymrat', 'es'], ['normal', 'en'], ['normal', 'es']]);
  });
});

describe('pickMaleVoice', () => {
  const v = (name: string, lang: string) => ({ name, lang, voiceURI: name }) as SpeechSynthesisVoice;

  it('prefers a male Venezuelan or Latin American voice and never a female one', () => {
    const voices = [v('Microsoft Helena - Spanish (Spain)', 'es-ES'), v('Paulina', 'es-MX'), v('Microsoft Pablo - Spanish (Spain)', 'es-ES'), v('Juan', 'es-MX')];
    expect(pickMaleVoice(voices, 'es')?.name).toBe('Juan');
    expect(pickMaleVoice([v('Microsoft Helena', 'es-ES'), v('Microsoft Pablo', 'es-ES')], 'es')?.name).toBe('Microsoft Pablo');
  });

  it('returns nothing when only female voices exist (the on-device male voice takes over)', () => {
    expect(pickMaleVoice([v('Paulina', 'es-MX'), v('Google español female', 'es-ES')], 'es')).toBeUndefined();
  });

  it('knows Android male voices by id', () => {
    expect(pickMaleVoice([v('es-us-x-esc-local', 'es-US'), v('es-us-x-esd-local', 'es-US')], 'es')?.name).toBe('es-us-x-esd-local');
  });
});
