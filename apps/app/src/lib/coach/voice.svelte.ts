import type { CoachLocale } from './lines';
import { pickMaleVoice } from './male-voice';

const KEY = 'gymup.coach.voice';

export type VoicePref = 'on' | 'off' | null;

function readPref(): VoicePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

async function systemVoices(): Promise<SpeechSynthesisVoice[]> {
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

type Tts = InstanceType<typeof import('runonweb/tts')['TextToSpeech']>;

/**
 * The Coach's voice, on this device only. Uses the system speech engine with a male voice; when the device has no
 * male voice it falls back to RunOnWeb's on-device TTS (downloaded on first use). Never talks over the voice assistant.
 */
class CoachVoice {
  /** `null` until the user answers the "¿Quieres que el Coach te hable?" question. */
  pref = $state<VoicePref>(readPref());
  /** Set by the voice assistant while it listens: the Coach keeps quiet. */
  micBusy = false;
  #audio: HTMLAudioElement | undefined;
  #tts: Tts | undefined;

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
    if (!on) this.stop();
  }

  stop() {
    if (typeof window === 'undefined') return;
    window.speechSynthesis?.cancel();
    this.#audio?.pause();
    this.#audio = undefined;
  }

  /** Says the line aloud when the voice is on and the microphone is free. Never throws. */
  async speak(text: string, locale: CoachLocale): Promise<void> {
    if (!this.enabled || this.micBusy || typeof window === 'undefined') return;
    this.stop();
    try {
      const voice = 'speechSynthesis' in window ? pickMaleVoice(await systemVoices(), locale) : undefined;
      if (this.micBusy) return;
      if (voice) {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
        return;
      }
      await this.#speakOnDevice(text, locale);
    } catch {
      /* no voice available: the toast already showed the line */
    }
  }

  async #speakOnDevice(text: string, locale: CoachLocale) {
    const { TextToSpeech } = await import('runonweb/tts');
    this.#tts ??= new TextToSpeech({ size: 'small', voice: 'em_alex' });
    const blob = await this.#tts.speakToBlob(text, { voice: locale === 'es' ? 'em_alex' : 'am_michael' });
    if (this.micBusy || !this.enabled) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    this.#audio = audio;
    await audio.play();
  }
}

export const coachVoice = new CoachVoice();
