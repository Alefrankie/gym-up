/** A short, friendly pop-up line at the top of the screen (one at a time, gone in a few seconds). */
class Nudge {
  text = $state<string | null>(null);
  kind = $state<'coach' | 'confirmation'>('coach');
  #timer: ReturnType<typeof setTimeout> | undefined;

  show(text: string, ms = 2800, kind: 'coach' | 'confirmation' = 'coach') {
    clearTimeout(this.#timer);
    this.kind = kind;
    this.text = text;
    navigator.vibrate?.([8, 40, 8]);
    this.#timer = setTimeout(() => (this.text = null), ms);
  }

  hide() {
    clearTimeout(this.#timer);
    this.text = null;
  }
}

export const nudge = new Nudge();
