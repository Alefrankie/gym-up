import { COACH_CLOUD_VOICES, type CoachCloudVoice } from '@gym-up/contracts';
import { API_URL } from '#lib/api/config';
import { tokenStore } from '#lib/api/token';
import type { CoachLocale } from './lines';
import { pickMaleVoice } from './male-voice';
import { coachRecordings } from './recordings.svelte';
import { chooseSource } from './studio';

const KEY = 'gymup.coach.voice';
const VOICE_KEY = 'gymup.coach.voiceId';
const CLOUD_CACHE = 'coach-voice-v1';
// Set when the API says today's free cloud-voice budget is used up: new lines wait until the next UTC day.
const CLOUD_PAUSE_KEY = 'gymup.coach.cloudPausedUntil';

const cloudPaused = () => {
  try {
    return Date.now() < Number(localStorage.getItem(CLOUD_PAUSE_KEY) ?? 0);
  } catch {
    return false;
  }
};

function pauseCloudUntilTomorrow() {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  try {
    localStorage.setItem(CLOUD_PAUSE_KEY, String(next.getTime()));
  } catch {
    /* private mode: the API keeps saying 429 anyway */
  }
}

/**
 * Which voice speaks, chosen in Settings (on this device):
 * - `auto`: the phone's own male voice (Android TextToSpeech in the app, the browser's voice on the web).
 * - `native:<name>`: one specific Android voice.
 * - `aura:<speaker>`: a natural male voice generated in the cloud and kept on the device once heard.
 */
export type CoachVoiceId = 'auto' | `native:${string}` | CoachCloudVoice;

export const isCloudVoice = (id: string): id is CoachCloudVoice => (COACH_CLOUD_VOICES as readonly string[]).includes(id);

export function parseVoiceId(v: string | null): CoachVoiceId {
  if (!v) return 'auto';
  if (isCloudVoice(v) || (v.startsWith('native:') && v.length > 7)) return v as CoachVoiceId;
  return 'auto';
}

export interface VoiceOption {
  id: CoachVoiceId;
  /** Speaker name for cloud voices, voice id for Android ones. */
  name: string;
  kind: 'auto' | 'native' | 'cloud';
  locale?: string;
}

/** Cloud voices by name, in the order the user compares them. */
export const CLOUD_OPTIONS: VoiceOption[] = COACH_CLOUD_VOICES.map((id) => ({ id, kind: 'cloud', name: id.slice(id.indexOf(':') + 1) }));

/** The same line for every option, so they can be compared by ear. */
export const SAMPLE_LINE = '¡Épale! Se acabó el descanso. Dale que vamos, una serie más.';

export interface SpeakResult {
  ok: boolean;
  /** From the request to the first sound. */
  latencyMs: number | null;
}

export type VoicePref = 'on' | 'off' | null;

/**
 * Where the Coach's voice comes from:
 * - `native`: the Android app. Its WebView has no `speechSynthesis`, so Android's own TextToSpeech speaks
 *   through the coach-voice plugin.
 * - `system`: a browser with a male system voice.
 * - `device`: a browser without one: RunOnWeb's on-device male voice, downloaded once.
 */
export type VoiceBackend = 'native' | 'system' | 'device';

export function chooseBackend(o: { inApp: boolean; maleSystemVoice: boolean }): VoiceBackend {
  if (o.inApp) return 'native';
  return o.maleSystemVoice ? 'system' : 'device';
}

/** What Settings shows instead of failing in silence. */
export type VoiceProblem =
  | { kind: 'noVoice' }
  | { kind: 'notMale'; voice: string | null }
  | { kind: 'failed'; message: string };

interface NativeStatus {
  available: boolean;
  male: boolean;
  voice: string | null;
  engine: string | null;
  voices: { name: string; locale: string; male: boolean }[];
  latencyMs?: number | null;
}

/** Download and load of the on-device voice, as Settings shows it. */
export type VoiceDownload =
  | { phase: 'download'; loadedMb: number | null; totalMb: number | null; percent: number | null }
  | { phase: 'load' }
  | { phase: 'ready' };

const mb = (bytes: number | undefined) => (bytes === undefined ? null : Math.round((bytes / 1048576) * 10) / 10);

/** Turns RunOnWeb's progress events into what the user sees. Per-file events are ignored once totals arrive. */
export function toDownload(info: { status: string; progress?: number; loaded?: number; total?: number }, hasTotal: boolean): VoiceDownload | null {
  if (info.status === 'ready') return { phase: 'ready' };
  if (info.status === 'progress_total' || (!hasTotal && info.status === 'progress')) {
    const percent = info.progress ?? (info.loaded !== undefined && info.total ? (info.loaded / info.total) * 100 : undefined);
    return { phase: 'download', loadedMb: mb(info.loaded), totalMb: mb(info.total), percent: percent === undefined ? null : Math.min(100, Math.round(percent)) };
  }
  if (info.status === 'done' || info.status === 'loading' || info.status === 'initiate') return hasTotal || info.status !== 'initiate' ? { phase: 'load' } : null;
  return null;
}

const inApp = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(`plugin:coach-voice|${cmd}`, args);
}

function readVoiceId(): CoachVoiceId {
  try {
    return parseVoiceId(localStorage.getItem(VOICE_KEY));
  } catch {
    return 'auto';
  }
}

function readPref(): VoicePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

async function systemVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return [];
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return now;
  // Chrome fills the list a moment after start.
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1200);
  });
}

const errorText = (e: unknown) =>
  (e instanceof Error ? e.message : typeof e === 'string' ? e : String(e)).replace(/^.*?(TIMEOUT|NO_VOICE): /, '');

/** Gives up on a voice that never starts, so Settings can say so instead of spinning forever. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('la voz no respondió a tiempo')), ms))]);
}

type Tts = InstanceType<typeof import('runonweb/tts')['TextToSpeech']>;

/** The Coach's voice, on this device only. Always a man's voice; never talks over the voice assistant. */
class CoachVoice {
  /** `null` until the user answers the "¿Quieres que el Coach te hable?" question. */
  pref = $state<VoicePref>(readPref());
  /** The last thing that kept the Coach from speaking (or a warning about the voice), for Settings. */
  problem = $state<VoiceProblem | null>(null);
  /** Progress of the one-time on-device voice download (browsers without a male voice). */
  download = $state<VoiceDownload | null>(null);
  /** A test line is being prepared or said. */
  busy = $state(false);
  /** Set by the voice assistant while it listens: the Coach keeps quiet. */
  micBusy = false;
  readonly inApp = inApp();
  /** The voice that speaks everywhere. */
  voiceId = $state<CoachVoiceId>(readVoiceId());
  /** Settings picker: the option being tried, and the last tap-to-sound time or error of each. */
  trying = $state<CoachVoiceId | null>(null);
  tried = $state<Record<string, { latencyMs: number | null; error?: string }>>({});
  #audio: HTMLAudioElement | undefined;
  #tts: Promise<Tts> | undefined;

  get enabled(): boolean {
    return this.pref === 'on';
  }

  set(on: boolean) {
    this.pref = on ? 'on' : 'off';
    try {
      localStorage.setItem(KEY, this.pref);
    } catch {
      /* private mode: the choice lasts for this session only */
    }
    if (!on) {
      this.stop();
      this.problem = null;
    }
  }

  choose(id: CoachVoiceId) {
    this.voiceId = id;
    try {
      localStorage.setItem(VOICE_KEY, id);
    } catch {
      /* private mode: the choice lasts for this session only */
    }
  }

  /** What the picker offers on this device: the phone's male voices (in the app) and the cloud ones. */
  async options(): Promise<VoiceOption[]> {
    const phone: VoiceOption[] = [{ id: 'auto', kind: 'auto', name: 'auto' }];
    if (this.inApp) {
      try {
        const status = await withTimeout(invoke<NativeStatus>('status', { lang: 'es' }), 5000);
        for (const v of status.voices.filter((v) => v.male)) phone.push({ id: `native:${v.name}`, kind: 'native', name: v.name, locale: v.locale });
      } catch {
        /* no engine: only the automatic choice, which reports the problem */
      }
    }
    return [...phone, ...CLOUD_OPTIONS];
  }

  /** Plays the sample with one option (even if the voice is off) and records how long it took to sound. */
  async tryOption(id: CoachVoiceId): Promise<void> {
    if (this.trying) return;
    this.trying = id;
    try {
      const r = await this.#say(SAMPLE_LINE, 'es', id);
      const error = r.ok ? undefined : this.problem?.kind === 'failed' ? this.problem.message : 'sin voz';
      this.tried = { ...this.tried, [id]: { latencyMs: r.latencyMs, ...(error ? { error } : {}) } };
    } finally {
      this.trying = null;
    }
  }

  stop() {
    if (typeof window === 'undefined') return;
    if (this.inApp) void invoke('stop').catch(() => {});
    window.speechSynthesis?.cancel();
    this.#audio?.pause();
    this.#audio = undefined;
  }

  /** Says a line now, from Settings; `busy` while it is being prepared or said. */
  async test(text: string, locale: CoachLocale): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      return (await this.speak(text, locale)).ok;
    } finally {
      this.busy = false;
    }
  }

  /** After the user turns the voice on in a browser that will need the download: start it right away. */
  prewarm() {
    if (this.inApp || this.#tts || typeof window === 'undefined') return;
    void systemVoices().then((voices) => {
      if (!pickMaleVoice(voices, 'es') && this.enabled) this.#deviceTts().catch(() => {});
    });
  }

  /**
   * In the Android app, asks Android to say `text` at `atMs` with the phone voice, so the rest-end line sounds even
   * with the screen locked (the WebView sleeps then). Android skips it when the app is in front, where the app
   * speaks itself. A no-op on the web or with the voice off.
   */
  async scheduleAt(text: string, locale: CoachLocale, atMs: number): Promise<boolean> {
    if (!this.inApp || !this.enabled) return false;
    const voice = this.voiceId.startsWith('native:') ? this.voiceId.slice(7) : undefined;
    try {
      await invoke('schedule_speak', { text, lang: locale, atMs, ...(voice ? { voice } : {}) });
      return true;
    } catch (e) {
      console.warn('[coach-voice] could not schedule', e);
      return false;
    }
  }

  async cancelScheduled() {
    if (this.inApp) await invoke('cancel_scheduled').catch(() => {});
  }

  /** Opens Android's text-to-speech settings to install or choose a voice. */
  async openSystemSettings() {
    await invoke('open_settings').catch(() => {});
  }

  /**
   * Says the line aloud with the chosen voice when the voice is on and the microphone is free. Never throws: what
   * went wrong ends up in `problem`. A cloud voice that cannot be reached (no signal) falls back to the phone's.
   */
  async speak(text: string, locale: CoachLocale): Promise<SpeakResult> {
    if (!this.enabled || this.micBusy || typeof window === 'undefined') return { ok: false, latencyMs: null };
    return this.#say(text, locale, this.voiceId);
  }

  async #say(text: string, locale: CoachLocale, id: CoachVoiceId): Promise<SpeakResult> {
    this.stop();
    try {
      // A line recorded in the voice studio beats any synthetic voice.
      const recording = await coachRecordings.find(text).catch(() => undefined);
      const source = chooseSource({ recorded: !!recording, cloudChosen: isCloudVoice(id), cloudAvailable: !cloudPaused() });
      if (source === 'recording' && recording) {
        try {
          const started = performance.now();
          const blob = await coachRecordings.audio(recording);
          if (this.micBusy) return { ok: false, latencyMs: null };
          const latencyMs = await this.#play(blob, started);
          this.problem = null;
          return { ok: true, latencyMs };
        } catch (e) {
          console.warn('[coach-voice] recording failed, using the chosen voice', e);
        }
      }
      if (isCloudVoice(id)) {
        try {
          return await this.#speakCloud(text, locale, id);
        } catch (e) {
          console.warn('[coach-voice] cloud voice failed, using the phone voice', e);
          const fallback = await this.#speakPhone(text, locale, 'auto');
          this.problem = { kind: 'failed', message: errorText(e) };
          return { ...fallback, ok: false };
        }
      }
      return await this.#speakPhone(text, locale, id);
    } catch (e) {
      this.problem = { kind: 'failed', message: errorText(e) };
      console.warn('[coach-voice]', e);
      return { ok: false, latencyMs: null };
    }
  }

  async #speakPhone(text: string, locale: CoachLocale, id: CoachVoiceId): Promise<SpeakResult> {
    const started = performance.now();
    if (this.inApp) return this.#speakNative(text, locale, id.startsWith('native:') ? id.slice(7) : undefined);
    const voice = pickMaleVoice(await systemVoices(), locale);
    if (this.micBusy) return { ok: false, latencyMs: null };
    if (chooseBackend({ inApp: false, maleSystemVoice: !!voice }) === 'system') {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice!;
      u.lang = voice!.lang;
      u.rate = 1.05;
      const latency = new Promise<number>((resolve) => u.addEventListener('start', () => resolve(Math.round(performance.now() - started)), { once: true }));
      window.speechSynthesis.speak(u);
      this.problem = null;
      return { ok: true, latencyMs: await withTimeout(latency, 8000).catch(() => null) };
    }
    return this.#speakOnDevice(text, locale, started);
  }

  /**
   * A natural cloud voice. Each line is fetched once from the API and kept in Cache Storage, so it plays at once
   * (and offline) the next time.
   */
  async #speakCloud(text: string, locale: CoachLocale, voice: CoachCloudVoice): Promise<SpeakResult> {
    const started = performance.now();
    const url = `${API_URL}/coach/voice?${new URLSearchParams({ voice, lang: locale, text })}`;
    let cache: Cache | undefined;
    try {
      cache = await caches.open(CLOUD_CACHE);
    } catch {
      /* no Cache Storage (private mode): fetch every time */
    }
    let res = await cache?.match(url);
    if (!res) {
      if (cloudPaused()) throw new Error('la voz de la nube gratis de hoy ya se usó; vuelve mañana');
      const token = tokenStore.get();
      res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(8000) });
      if (res.status === 429) {
        pauseCloudUntilTomorrow();
        throw new Error('la voz de la nube gratis de hoy ya se usó; vuelve mañana');
      }
      if (!res.ok) throw new Error(`la voz de la nube respondió ${res.status}`);
      await cache?.put(url, res.clone()).catch(() => {});
    }
    const blob = await res.blob();
    if (this.micBusy) return { ok: false, latencyMs: null };
    const latencyMs = await this.#play(blob, started);
    this.problem = null;
    return { ok: true, latencyMs };
  }

  /** Plays audio and resolves with the time from `started` to the first sound. */
  async #play(blob: Blob, started: number): Promise<number> {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    this.#audio = audio;
    const playing = new Promise<number>((resolve) => audio.addEventListener('playing', () => resolve(Math.round(performance.now() - started)), { once: true }));
    await audio.play();
    return withTimeout(playing, 8000);
  }

  async #speakNative(text: string, locale: CoachLocale, voice?: string): Promise<SpeakResult> {
    // One round trip: Android picks the voice and starts speaking right away (target: sound in under half a second).
    try {
      const done = await withTimeout(invoke<NativeStatus>('speak', { text, lang: locale, ...(voice ? { voice } : {}) }), 8000);
      console.info('[coach-voice] native', { voice: done.voice, male: done.male, latencyMs: done.latencyMs });
      this.problem = done.male ? null : { kind: 'notMale', voice: done.voice };
      return { ok: true, latencyMs: done.latencyMs ?? null };
    } catch (e) {
      if (String(e).includes('NO_VOICE')) {
        this.problem = { kind: 'noVoice' };
        return { ok: false, latencyMs: null };
      }
      throw e;
    }
  }

  /** Loads RunOnWeb's male voice once (shared by every caller), reporting the download in `download`. */
  #deviceTts(): Promise<Tts> {
    this.#tts ??= (async () => {
      const { TextToSpeech } = await import('runonweb/tts');
      let hasTotal = false;
      this.download = { phase: 'download', loadedMb: null, totalMb: null, percent: null };
      const tts = new TextToSpeech({
        size: 'small',
        voice: 'em_alex',
        onProgress: (info) => {
          hasTotal ||= info.status === 'progress_total';
          const next = toDownload(info, hasTotal);
          if (next && this.download?.phase !== 'ready') this.download = next;
        },
      });
      await tts.load();
      this.download = { phase: 'ready' };
      return tts;
    })().catch((e: unknown) => {
      this.#tts = undefined;
      this.download = null;
      throw e;
    });
    return this.#tts;
  }

  async #speakOnDevice(text: string, locale: CoachLocale, started: number): Promise<SpeakResult> {
    const tts = await this.#deviceTts();
    const blob = await tts.speakToBlob(text, { voice: locale === 'es' ? 'em_alex' : 'am_michael' });
    if (this.micBusy) return { ok: false, latencyMs: null };
    const latencyMs = await this.#play(blob, started);
    this.problem = null;
    return { ok: true, latencyMs };
  }
}

export const coachVoice = new CoachVoice();
