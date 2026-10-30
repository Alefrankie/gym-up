import { cancelRestEnd, scheduleRestEnd, vibrateRestEnd } from '#lib/notify';
import { coachSay } from '#lib/coach/coach.svelte';

export const REST_SECONDS = 90;
/** Once the rest is over and the next set has not started, the Coach speaks up this often, a few times at most. */
export const REST_NAG_SECONDS = 30;
const REST_NAG_MAX = 10;

/**
 * The rest countdown lives outside any screen: it keeps running while you move between the routine overview and an
 * exercise, and it is the same one the notification was scheduled for.
 */
class RestTimer {
  seconds = $state(0);
  #interval: ReturnType<typeof setInterval> | undefined;
  #nag: ReturnType<typeof setInterval> | undefined;

  /** `overdue` (the exercise just done) makes the Coach call you back when the rest runs long. */
  start(total = REST_SECONDS, overdue?: { exercise?: string }) {
    clearInterval(this.#interval);
    this.stopNag();
    this.seconds = total;
    void scheduleRestEnd(total);
    this.#interval = setInterval(() => {
      this.seconds -= 1;
      if (this.seconds <= 0) {
        clearInterval(this.#interval);
        this.seconds = 0;
        vibrateRestEnd();
        if (overdue) this.#startNag(total, overdue.exercise);
      }
    }, 1000);
  }

  skip() {
    clearInterval(this.#interval);
    this.stopNag();
    this.seconds = 0;
    void cancelRestEnd();
  }

  /** The next set started, or the workout ended: the Coach stops asking. */
  stopNag() {
    clearInterval(this.#nag);
    this.#nag = undefined;
  }

  #startNag(total: number, exercise: string | undefined) {
    let said = 0;
    const say = () => {
      coachSay('restLong', { restSeconds: total, ...(exercise ? { exercise } : {}) });
      if (++said >= REST_NAG_MAX) this.stopNag();
    };
    say();
    this.#nag = setInterval(say, REST_NAG_SECONDS * 1000);
  }

  get label(): string {
    return `${Math.floor(this.seconds / 60)}:${String(this.seconds % 60).padStart(2, '0')}`;
  }
}

export const restTimer = new RestTimer();
