import type { CoachLocale } from './lines';
import { pickMaleVoice } from './male-voice';

const KEY = 'gymup.coach.voice';

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
      return await this.speak(text, locale);
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

  /** Opens Android's text-to-speech settings to install or choose a voice. */
  async openSystemSettings() {
    await invoke('open_settings').catch(() => {});
  }

  /**
   * Says the line aloud when the voice is on and the microphone is free. Resolves once it was said (or could not
   * be); never throws. What went wrong ends up in `problem`.
   */
  async speak(text: string, locale: CoachLocale): Promise<boolean> {
    if (!this.enabled || this.micBusy || typeof window === 'undefined') return false;
    this.stop();
    try {
      if (this.inApp) return await this.#speakNative(text, locale);
      const voice = pickMaleVoice(await systemVoices(), locale);
      if (this.micBusy) return false;
      if (chooseBackend({ inApp: false, maleSystemVoice: !!voice }) === 'system') {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice!;
        u.lang = voice!.lang;
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
        this.problem = null;
        return true;
      }
      return await this.#speakOnDevice(text, locale);
    } catch (e) {
      this.problem = { kind: 'failed', message: errorText(e) };
      console.warn('[coach-voice]', e);
      return false;
    }
  }

  async #speakNative(text: string, locale: CoachLocale): Promise<boolean> {
    // One round trip: Android picks the voice and starts speaking right away (target: sound in under half a second).
    try {
      const done = await withTimeout(invoke<NativeStatus>('speak', { text, lang: locale }), 8000);
      console.info('[coach-voice] native', { voice: done.voice, male: done.male, latencyMs: done.latencyMs });
      this.problem = done.male ? null : { kind: 'notMale', voice: done.voice };
      return true;
    } catch (e) {
      if (String(e).includes('NO_VOICE')) {
        this.problem = { kind: 'noVoice' };
        return false;
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

  async #speakOnDevice(text: string, locale: CoachLocale): Promise<boolean> {
    const tts = await this.#deviceTts();
    const blob = await tts.speakToBlob(text, { voice: locale === 'es' ? 'em_alex' : 'am_michael' });
    if (this.micBusy || !this.enabled) return false;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    this.#audio = audio;
    await audio.play();
    this.problem = null;
    return true;
  }
}

export const coachVoice = new CoachVoice();
