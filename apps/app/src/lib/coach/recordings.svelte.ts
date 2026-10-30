import { coachRecordingListSchema, coachRecordingSchema, type CoachRecordingDto, type CoachTone } from '@gym-up/contracts';
import { API_URL } from '#lib/api/config';
import { tokenStore } from '#lib/api/token';
import { cachedGet } from '#lib/offline/cache';
import { recordingId, STUDIO_SLOT, type StudioLine } from './studio';

const AUDIO_CACHE = 'coach-recordings-v1';

const auth = (): Record<string, string> => {
  const token = tokenStore.get();
  return token ? { authorization: `Bearer ${token}` } : {};
};

/**
 * The Coach's lines recorded in the voice studio. The list comes from the API (and is kept for offline use); each
 * recording is downloaded once and kept in Cache Storage, so it plays at once and with no signal.
 */
class CoachRecordings {
  items = $state<CoachRecordingDto[]>([]);
  #byId = new Map<string, CoachRecordingDto>();
  #loading: Promise<void> | undefined;

  #set(items: CoachRecordingDto[]) {
    this.items = items;
    this.#byId = new Map(items.map((i) => [i.id, i]));
  }

  /** Loads the list once per app start (a saved copy first, so it also works offline). */
  load(force = false): Promise<void> {
    if (force || !this.#loading) {
      this.#loading = cachedGet('/coach/recordings', coachRecordingListSchema, { onCached: (c) => this.#set(c.data.items) })
        .then((r) => this.#set(r.data.items))
        .catch(() => {
          /* offline with nothing saved, or signed out: no recordings, the other voices speak */
        });
    }
    return this.#loading;
  }

  /** The recording of these exact words, if there is one. */
  async find(text: string): Promise<CoachRecordingDto | undefined> {
    await this.load();
    if (!this.#byId.size) return undefined;
    return this.#byId.get(await recordingId(text, STUDIO_SLOT));
  }

  byId(id: string): CoachRecordingDto | undefined {
    return this.#byId.get(id);
  }

  url(r: CoachRecordingDto): string {
    return `${API_URL}/coach/recordings/${r.id}?v=${r.updatedAt}`;
  }

  /** The audio, from the device when already downloaded. */
  async audio(r: CoachRecordingDto): Promise<Blob> {
    const url = this.url(r);
    let cache: Cache | undefined;
    try {
      cache = await caches.open(AUDIO_CACHE);
    } catch {
      /* no Cache Storage: download every time */
    }
    let res = await cache?.match(url);
    if (!res) {
      res = await fetch(url, { headers: auth(), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`la grabación respondió ${res.status}`);
      await cache?.put(url, res.clone()).catch(() => {});
    }
    return res.blob();
  }

  /** Downloads in the background every recording of a tone, so a workout plays them offline. */
  async prefetch(tone: CoachTone): Promise<void> {
    await this.load();
    for (const r of this.items.filter((i) => i.tone === tone)) {
      try {
        await this.audio(r);
      } catch {
        return; // no signal: try again next time
      }
    }
  }

  /** Admin: saves (or replaces) the take of a studio line. */
  async save(line: StudioLine, take: Blob): Promise<CoachRecordingDto> {
    const id = await recordingId(line.text, STUDIO_SLOT);
    const query = new URLSearchParams({ tone: line.tone, locale: line.locale, event: line.event, text: line.text, ...(line.form ? { form: line.form } : {}) });
    const res = await fetch(`${API_URL}/coach/recordings/${id}?${query}`, {
      method: 'PUT',
      headers: { ...auth(), 'content-type': take.type || 'audio/webm' },
      body: take,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`no se pudo guardar (${res.status})`);
    const saved = coachRecordingSchema.parse(await res.json());
    this.#set([...this.items.filter((i) => i.id !== id), saved]);
    return saved;
  }

  /** Admin: deletes a take; the line goes back to the cloud or phone voice. */
  async remove(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/coach/recordings/${id}`, { method: 'DELETE', headers: auth(), signal: AbortSignal.timeout(10_000) });
    if (!res.ok && res.status !== 404) throw new Error(`no se pudo borrar (${res.status})`);
    this.#set(this.items.filter((i) => i.id !== id));
  }
}

export const coachRecordings = new CoachRecordings();
