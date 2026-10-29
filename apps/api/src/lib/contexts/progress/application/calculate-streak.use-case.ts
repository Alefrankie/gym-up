// src/lib/contexts/progress/application/calculate-streak.use-case.ts
//
// Use case: fetch the user's current streak + total completed-workout days.
// Passthrough to the repository; kept as a separate use case per
// architecture readme (so the application layer owns the contract).

import type { Streak } from '../domain/progress.types';
import type { GetStreakInput } from '../domain/progress.types';
import { type ProgressRepository } from '../domain/ports/ProgressRepository';

export class CalculateStreakUseCase {
  constructor(private readonly progressRepository: ProgressRepository) {}

  async execute(input: GetStreakInput): Promise<Streak> {
    return this.progressRepository.getStreak(input.userId);
  }
}
