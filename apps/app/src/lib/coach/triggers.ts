import type { SetType } from '@gym-up/contracts';
import type { CoachEvent } from './lines';

/** At most one Coach line every this many milliseconds during a workout... */
export const LIMIT_MS = 20_000;
/** ...except for these, which always speak: they answer something the user just did or must not miss. */
export const URGENT: ReadonlySet<CoachEvent> = new Set<CoachEvent>(['pr', 'progressUp', 'restEnd', 'finish', 'weightDrop']);

export class Limiter {
  #last = Number.NEGATIVE_INFINITY;
  constructor(private readonly gapMs = LIMIT_MS) {}

  /** Whether the event may speak now; when it does, the clock restarts. */
  allow(event: CoachEvent, now = Date.now()): boolean {
    if (!URGENT.has(event) && now - this.#last < this.gapMs) return false;
    this.#last = now;
    return true;
  }
}

interface SetLike {
  weight: number;
  reps: number;
  type?: SetType;
}

export type SetReaction = 'pr' | 'progressUp' | 'setDone';

const beats = (a: SetLike, b: { weight: number; reps: number }) => a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps);

/**
 * What the Coach says when a set is ticked, all weights in the same unit:
 * - `pr`: beats the all-time best (and anything heavier already done today),
 * - `progressUp`: beats the same set of last session (heavier, or more reps at no less weight),
 * - `setDone` otherwise. Warm-ups are always `setDone`.
 */
export function reactToSet(
  set: SetLike,
  last: { weight: number; reps: number } | null,
  record: { weight: number; reps: number } | null,
  earlierToday: SetLike[] = [],
): SetReaction {
  if (set.type === 'warmup' || set.weight <= 0 && set.reps <= 0) return 'setDone';
  if (record) {
    const best = earlierToday.filter((s) => s.type !== 'warmup').reduce((b, s) => (beats(s, b) ? s : b), record);
    if (beats(set, best)) return 'pr';
  }
  if (last && (set.weight > last.weight || (set.reps > last.reps && set.weight >= last.weight))) return 'progressUp';
  return 'setDone';
}
