import { coachCatalogSchema, type CoachCatalog } from '@gym-up/contracts';
import { cachedGet } from '#lib/offline/cache';
import type { CoachEvent } from './lines';
import { setCatalogExtras, type CatalogExtras } from './pick';

/**
 * Turns the API's catalog into what the picker merges: the variants of an added line become one `{m|f}` template
 * (or plain text when it reads the same for everyone), and edits become a map from the original rendering.
 */
export function toExtras(c: CoachCatalog): CatalogExtras {
  const groups = new Map<string, CoachCatalog['custom']>();
  for (const l of c.custom) groups.set(l.groupId, [...(groups.get(l.groupId) ?? []), l]);
  const lines: CatalogExtras['lines'] = [];
  for (const variants of groups.values()) {
    const m = variants.find((v) => v.form === 'm');
    const f = variants.find((v) => v.form === 'f');
    const any = variants[0]!;
    const template = m && f ? `{${m.text}|${f.text}}` : any.text;
    lines.push({ tone: any.tone, locale: any.locale, event: any.event as CoachEvent, template });
  }
  return { lines, overrides: new Map(c.overrides.map((o) => [o.originalText, o.text])) };
}

/** Loads the voice studio's additions once per app start (a saved copy first, so they work offline too). */
class CoachCatalogLoader {
  #loading: Promise<void> | undefined;

  load(force = false): Promise<void> {
    if (force || !this.#loading) {
      this.#loading = cachedGet('/coach/catalog', coachCatalogSchema, { onCached: (c) => setCatalogExtras(toExtras(c.data)) })
        .then((r) => setCatalogExtras(toExtras(r.data)))
        .catch(() => {
          /* offline with nothing saved, or signed out: the built-in catalog alone */
        });
    }
    return this.#loading;
  }
}

export const coachCatalog = new CoachCatalogLoader();
