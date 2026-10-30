import type { CoachLocale } from './lines';

// The Coach always speaks with a man's voice. Browsers do not say which voices are male, so we go by name:
// the usual male system voices (Windows, macOS/iOS, Android's Google voices) and anything labelled "male".
const MALE =
  /\b(male|hombre|masculin\w*|jorge|diego|juan|carlos|pablo|ra[uú]l|[aá]lvaro|enrique|gonzalo|jos[eé]|andr[eé]s|miguel|antonio|alberto|daniel|david|alex|fred|tom|aaron|arthur|gordon|guy|james|mark|george|ryan|eddy|reed|rocko|ralph|lee|oliver|thomas|es-us-x-es[df]|es-es-x-ee[df]|en-us-x-io[lm]|en-us-x-tpd)\b/i;
const FEMALE = /female|mujer|femenin/i;

const LANGS: Record<CoachLocale, string[]> = {
  es: ['es-VE', 'es-419', 'es-US', 'es-MX', 'es-CO', 'es'],
  en: ['en-US', 'en-GB', 'en'],
};

/** The best male system voice for the language (Venezuelan or Latin American Spanish first), if there is one. */
export function pickMaleVoice(voices: readonly SpeechSynthesisVoice[], locale: CoachLocale): SpeechSynthesisVoice | undefined {
  const male = voices.filter((v) => MALE.test(`${v.name} ${v.voiceURI}`) && !FEMALE.test(v.name));
  for (const lang of LANGS[locale]) {
    const exact = male.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
    if (exact) return exact;
  }
  return male.find((v) => v.lang.toLowerCase().startsWith(locale));
}
