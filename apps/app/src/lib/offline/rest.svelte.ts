import { cancelRestEnd, scheduleRestEnd, vibrateRestEnd } from '#lib/notify';
import { coachAnnounce, coachLine, coachSay } from '#lib/coach/coach.svelte';
import type { PickedLine } from '#lib/coach/pick';
import { coachVoice } from '#lib/coach/voice.svelte';

export const REST_SECONDS = 90;
/** After the rest-end line, if the next set has not started, the Coach calls you back this often, a few times. */
export const REST_NAG_SECONDS = 30;
const REST_NAG_MAX = 10;
/** Rests this short get no "halfway" line. */
const HALF_MIN_SECONDS = 40;
/** Later than this, the rest ended while the app was asleep and Android already said the line. */
const LATE_MS = 1500;

/**
 * The rest countdown lives outside any screen: it keeps running while you move between the routine overview and an
 * exercise, and it is the same one the notification was scheduled for. It follows the wall clock, so it is right
 * again the moment the app wakes up (the WebView's timers stop while the screen is locked).
 *
 * With sets still to do, the Coach says a line halfway, says "back to work" the instant the rest ends, and calls you
 * back every 30 s after that. The rest-end line is picked when the rest starts and also handed to Android, which says
 * it on time if the screen is locked then.
 */
class RestTimer {
  seconds = $state(0);
  #interval: ReturnType<typeof setInterval> | undefined;
  #nag: ReturnType<typeof setTimeout> | undefined;
  #endsAt = 0;
  #total = 0;
  #context: { exercise?: string } | null = null;
  #halfSaid = false;
  #endLine: PickedLine | null = null;
  #nativeScheduled = false;

  constructor() {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.#tick());
  }

  /** `context` (the exercise just done) when sets remain: the Coach then talks during and after the rest. */
  start(total = REST_SECONDS, context?: { exercise?: string }) {
    this.#clear();
    this.#total = total;
    this.#endsAt = Date.now() + total * 1000;
    this.#context = context ?? null;
    this.#halfSaid = false;
    this.seconds = total;
    void scheduleRestEnd(total);
    if (context) {
      this.#endLine = coachLine('restEnd', { restSeconds: total, ...(context.exercise ? { exercise: context.exercise } : {}) });
      if (this.#endLine) {
        const endsAt = this.#endsAt;
        void coachVoice.scheduleAt(this.#endLine.text, this.#endLine.locale, endsAt).then((ok) => {
          if (this.#endsAt === endsAt) this.#nativeScheduled = ok;
        });
      }
    }
    this.#interval = setInterval(() => this.#tick(), 250);
  }

  skip() {
    this.#clear();
    this.seconds = 0;
    void cancelRestEnd();
  }

  /** The next set is being prepared or the workout ended: the Coach stops calling you back. */
  stopNag() {
    clearTimeout(this.#nag);
    this.#nag = undefined;
  }

  #clear() {
    clearInterval(this.#interval);
    this.#interval = undefined;
    this.stopNag();
    if (this.#nativeScheduled || this.#endLine) void coachVoice.cancelScheduled();
    this.#nativeScheduled = false;
    this.#endLine = null;
    this.#context = null;
  }

  #tick() {
    if (!this.#interval) return;
    const left = Math.max(0, Math.ceil((this.#endsAt - Date.now()) / 1000));
    this.seconds = left;
    const ctx = this.#context;
    if (ctx && !this.#halfSaid && left > 0 && this.#total >= HALF_MIN_SECONDS && left <= this.#total / 2) {
      this.#halfSaid = true;
      coachSay('restHalf', { restSeconds: this.#total, ...(ctx.exercise ? { exercise: ctx.exercise } : {}) });
    }
    if (left <= 0) this.#end();
  }

  #end() {
    clearInterval(this.#interval);
    this.#interval = undefined;
    this.seconds = 0;
    vibrateRestEnd();
    const ctx = this.#context;
    const line = this.#endLine;
    const late = Date.now() - this.#endsAt;
    void coachVoice.cancelScheduled();
    if (ctx && line) {
      // Asleep at the end: Android said it on time; the toast still shows it when the app comes back.
      coachAnnounce(line, { speak: !(this.#nativeScheduled && late > LATE_MS) });
      this.#startNag(ctx.exercise);
    }
    this.#nativeScheduled = false;
    this.#endLine = null;
  }

  #startNag(exercise: string | undefined) {
    let said = 0;
    const total = this.#total;
    const say = () => {
      coachSay('restLong', { restSeconds: total, ...(exercise ? { exercise } : {}) });
      this.#nag = ++said < REST_NAG_MAX ? setTimeout(say, REST_NAG_SECONDS * 1000) : undefined;
    };
    this.#nag = setTimeout(say, REST_NAG_SECONDS * 1000);
  }

  get label(): string {
    return `${Math.floor(this.seconds / 60)}:${String(this.seconds % 60).padStart(2, '0')}`;
  }
}

export const restTimer = new RestTimer();
