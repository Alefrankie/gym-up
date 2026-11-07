// src/lib/contexts/progress/application/freeze-streak.use-case.ts
//
// Use case: freeze yesterday so a missed training day does not break the streak.
// Per DR-0032: yesterday only, one freeze per ISO week, only when there is a streak to save.

import type { FreezeStreakInput, Streak } from '../domain/progress.types';
import { type ProgressRepository } from '../domain/ports/ProgressRepository';

export class StreakFreezeNotAllowedError extends Error {
  constructor() {
    super('Yesterday cannot be frozen');
    this.name = 'StreakFreezeNotAllowedError';
  }
}

export class FreezeStreakUseCase {
  constructor(private readonly progressRepository: ProgressRepository) {}

  async execute(input: FreezeStreakInput): Promise<Streak> {
    const streak = await this.progressRepository.getStreak(input.userId);
    if (!streak.canFreeze) throw new StreakFreezeNotAllowedError();

    const yesterday = new Date();
    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await this.progressRepository.addFreeze(input.userId, yesterday.toISOString().split('T')[0]);
    return this.progressRepository.getStreak(input.userId);
  }
}
