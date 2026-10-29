import { cancelRestEnd, scheduleRestEnd, vibrateRestEnd } from '#lib/notify';

export const REST_SECONDS = 90;

/**
 * The rest countdown lives outside any screen: it keeps running while you move between the routine overview and an
 * exercise, and it is the same one the notification was scheduled for.
 */
class RestTimer {
  seconds = $state(0);
  #interval: ReturnType<typeof setInterval> | undefined;

  start(total = REST_SECONDS) {
    clearInterval(this.#interval);
    this.seconds = total;
    void scheduleRestEnd(total);
    this.#interval = setInterval(() => {
      this.seconds -= 1;
      if (this.seconds <= 0) {
        clearInterval(this.#interval);
        this.seconds = 0;
        vibrateRestEnd();
      }
    }, 1000);
  }

  skip() {
    clearInterval(this.#interval);
    this.seconds = 0;
    void cancelRestEnd();
  }

  get label(): string {
    return `${Math.floor(this.seconds / 60)}:${String(this.seconds % 60).padStart(2, '0')}`;
  }
}

export const restTimer = new RestTimer();
