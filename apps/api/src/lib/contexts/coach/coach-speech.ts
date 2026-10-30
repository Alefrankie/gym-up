// src/lib/contexts/coach/coach-speech.ts
//
// The Coach's cloud voice: one line of text in, Ogg Opus audio out. Every line is cached by voice, language
// and text, so a line is generated (and paid for) once. The provider is chosen by the voice id prefix
// (`aura:` = Deepgram Aura-2 on Workers AI), so another provider can be added next to it.

import type { CoachCloudVoice } from '@gym-up/contracts';

export interface CoachSpeechRequest {
  voice: CoachCloudVoice;
  lang: 'es' | 'en';
  text: string;
}

export interface CoachAudio {
  bytes: Uint8Array;
  contentType: string;
  /** Whether it came from the cache (no provider call). */
  cached: boolean;
}

export interface CoachSpeech {
  speak(request: CoachSpeechRequest): Promise<CoachAudio>;
}

/** Where generated lines are kept (R2 when bound, else the data center cache). */
export interface AudioCache {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
}

/**
 * How many characters may be sent to the provider today (UTC). Workers AI gives 10,000 free neurons a day and
 * Aura-2 uses about 2.73 neurons per character, so a cap below ~3,600 characters keeps the account from ever being
 * billed; past it the app uses the phone voice until the next day.
 */
export interface VoiceBudget {
  /** Reserves `chars` for today; false when that would go over the cap (nothing is reserved then). */
  spend(chars: number): Promise<boolean>;
}

/** Thrown when today's free budget is used up; the API answers 429 and the app falls back to the phone voice. */
export class VoiceBudgetExceededError extends Error {
  constructor() {
    super('The free daily budget for the Coach cloud voice is used up');
    this.name = 'VoiceBudgetExceededError';
  }
}

/** The Workers AI binding, as far as this adapter needs it. */
export interface WorkersAiLike {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

const CONTENT_TYPE = 'audio/ogg';

// Aura-2 has a model per language. The Spanish voices are the ones the user picks; English lines use a male
// English voice of the same family.
const AURA_MODELS = { es: '@cf/deepgram/aura-2-es', en: '@cf/deepgram/aura-2-en' } as const;
const AURA_ENGLISH_SPEAKER = 'orion';

export async function cacheKey(r: CoachSpeechRequest): Promise<string> {
  const data = new TextEncoder().encode(`${r.voice}|${r.lang}|${r.text}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return `coach-voice/${r.voice}/${[...hash].map((b) => b.toString(16).padStart(2, '0')).join('')}.ogg`;
}

async function toBytes(out: unknown): Promise<Uint8Array> {
  if (out instanceof Uint8Array) return out;
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  // The binding answers with a stream of audio.
  return new Uint8Array(await new Response(out as ReadableStream).arrayBuffer());
}

export class WorkersAiCoachSpeech implements CoachSpeech {
  constructor(
    private readonly ai: WorkersAiLike,
    private readonly cache: AudioCache,
    private readonly budget?: VoiceBudget,
  ) {}

  async speak(r: CoachSpeechRequest): Promise<CoachAudio> {
    const key = await cacheKey(r);
    const hit = await this.cache.get(key);
    if (hit) return { bytes: hit, contentType: CONTENT_TYPE, cached: true };
    const [provider, speaker] = r.voice.split(':') as ['aura', string];
    if (provider !== 'aura') throw new Error(`Unknown voice provider: ${provider}`);
    // Cached lines are free; only a new line spends today's budget.
    if (this.budget && !(await this.budget.spend(r.text.length))) throw new VoiceBudgetExceededError();
    const out = await this.ai.run(AURA_MODELS[r.lang], {
      text: r.text,
      speaker: r.lang === 'es' ? speaker : AURA_ENGLISH_SPEAKER,
      encoding: 'opus',
      container: 'ogg',
      bit_rate: 24000,
    });
    const bytes = await toBytes(out);
    if (!bytes.length) throw new Error('The voice provider returned no audio');
    await this.cache.put(key, bytes);
    return { bytes, contentType: CONTENT_TYPE, cached: false };
  }
}

/** R2 bucket, as far as the cache needs it. */
export interface R2Like {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

export class R2AudioCache implements AudioCache {
  constructor(private readonly bucket: R2Like) {}
  async get(key: string) {
    const o = await this.bucket.get(key);
    return o ? new Uint8Array(await o.arrayBuffer()) : null;
  }
  async put(key: string, bytes: Uint8Array) {
    await this.bucket.put(key, bytes, { httpMetadata: { contentType: CONTENT_TYPE } });
  }
}

/** The Workers cache API (`caches.default`), as far as the cache needs it. */
export interface EdgeCacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/** Fallback without R2: the data center cache. It can evict lines, which then cost one more generation. */
export class EdgeAudioCache implements AudioCache {
  constructor(private readonly cache: EdgeCacheLike) {}
  #url = (key: string) => new Request(`https://coach-voice.cache.internal/${key}`);
  async get(key: string) {
    const r = await this.cache.match(this.#url(key));
    return r ? new Uint8Array(await r.arrayBuffer()) : null;
  }
  async put(key: string, bytes: Uint8Array) {
    await this.cache.put(
      this.#url(key),
      new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { 'content-type': CONTENT_TYPE, 'cache-control': 'public, max-age=31536000' } }),
    );
  }
}

export class InMemoryAudioCache implements AudioCache {
  readonly store = new Map<string, Uint8Array>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, bytes: Uint8Array) {
    this.store.set(key, bytes);
  }
}
