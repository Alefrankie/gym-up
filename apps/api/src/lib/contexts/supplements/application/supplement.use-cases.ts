import type { Supplement } from '@db/schema';
import {
  DEFAULT_SUPPLEMENTS,
  MAX_SUPPLEMENTS,
  SupplementLimitError,
  SupplementNotFoundError,
  type SupplementRepository,
} from '../domain/supplement.repository';

export interface SupplementDay {
  supplement: Supplement;
  /** Days taken in the requested window, oldest first. */
  days: string[];
}

/** `YYYY-MM-DD` minus `n` days, on the calendar (no time zones involved). */
export function minusDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * The checklist for a day, with the last `window` days of each supplement (for streaks and charts).
 * A user's first visit gets the common defaults so there is something to tick right away.
 */
export class GetSupplementsUseCase {
  constructor(private readonly repo: SupplementRepository) {}
  async execute(input: { userId: string; day: string; window: number }): Promise<SupplementDay[]> {
    if (!(await this.repo.hasAny(input.userId))) {
      for (const [i, name] of DEFAULT_SUPPLEMENTS.entries()) {
        await this.repo.create({ id: crypto.randomUUID(), userId: input.userId, name, sortOrder: i });
      }
    }
    const list = await this.repo.listActive(input.userId);
    const days = await this.repo.takenDays(list.map((s) => s.id), minusDays(input.day, input.window - 1), input.day);
    return list.map((supplement) => ({ supplement, days: days.get(supplement.id) ?? [] }));
  }
}

export class AddSupplementUseCase {
  constructor(private readonly repo: SupplementRepository) {}
  async execute(input: { userId: string; id: string; name: string }): Promise<Supplement> {
    const mine = await this.repo.findOwned(input.id, input.userId);
    if (mine) return mine;
    const n = await this.repo.countActive(input.userId);
    if (n >= MAX_SUPPLEMENTS) throw new SupplementLimitError();
    return this.repo.create({ id: input.id, userId: input.userId, name: input.name, sortOrder: n });
  }
}

export class RemoveSupplementUseCase {
  constructor(private readonly repo: SupplementRepository) {}
  async execute(input: { userId: string; id: string }): Promise<void> {
    if (!(await this.repo.findOwned(input.id, input.userId))) throw new SupplementNotFoundError(input.id);
    await this.repo.archive(input.id);
  }
}

/** Ticks or unticks a supplement for a day. Idempotent either way. */
export class MarkSupplementUseCase {
  constructor(private readonly repo: SupplementRepository) {}
  async execute(input: { userId: string; id: string; day: string; taken: boolean }): Promise<void> {
    if (!(await this.repo.findOwned(input.id, input.userId))) throw new SupplementNotFoundError(input.id);
    await this.repo.setTaken(input.id, input.day, input.taken);
  }
}
