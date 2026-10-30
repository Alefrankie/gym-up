import * as common from './messages/common';
import * as programs from './messages/programs';
import * as social from './messages/social';
import * as workout from './messages/workout';

/**
 * Spanish and English UI text. The device language picks the default; Settings can pin one.
 *
 * `t('area.key', { n: 3 })` replaces `{n}` in the text. Plurals use two keys, `….one` and `….other`,
 * through `tn('area.key', n)`. Reading `t` inside markup is reactive: switching language repaints at once.
 */
export type Locale = 'es' | 'en';
export type LocalePreference = Locale | 'system';

const es = { ...common.es, ...workout.es, ...programs.es, ...social.es };
const en: Record<keyof typeof es, string> = { ...common.en, ...workout.en, ...programs.en, ...social.en };
export type MessageKey = keyof typeof es;

const KEY = 'gymup.locale';

/** Spanish for any Spanish locale (es-ES, es-MX…), English for everything else. */
function deviceLocale(): Locale {
  const lang = (typeof navigator !== 'undefined' && (navigator.languages?.[0] ?? navigator.language)) || 'es';
  return lang.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function readPreference(): LocalePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'es' || v === 'en' ? v : 'system';
  } catch {
    return 'system';
  }
}

class I18n {
  preference = $state<LocalePreference>(readPreference());
  readonly locale: Locale = $derived(this.preference === 'system' ? deviceLocale() : this.preference);

  set(preference: LocalePreference) {
    this.preference = preference;
    try {
      if (preference === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, preference);
    } catch {
      /* private mode: the choice lasts for this session only */
    }
    document.documentElement.lang = this.locale;
  }
}

export const i18n = new I18n();

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const table = i18n.locale === 'en' ? en : es;
  let text: string = table[key] ?? es[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

/** Picks `key.one` for 1 and `key.other` otherwise, with `{n}` filled in. */
export function tn(key: string, n: number, params?: Record<string, string | number>): string {
  return t(`${key}.${n === 1 ? 'one' : 'other'}` as MessageKey, { n, ...params });
}

/** BCP 47 tag for dates and numbers in the current language. */
export const dateLocale = () => (i18n.locale === 'en' ? 'en' : 'es');
