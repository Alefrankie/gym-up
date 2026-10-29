// src/lib/contexts/nutrition/application/get-daily-calorie-summary.use-case.ts
//
// Use case: compute today's calorie summary (consumed vs goal).
//
// Per golden-rules: side-effect free read — no DB mutation.
// Per crew-learning: `now?: Date` in input DTO for testability.

import type { NutritionEntryRepository } from '../domain/nutrition-entry-repository';
import type { NutritionGoalRepository } from '../domain/nutrition-goal-repository';
import type { DailySummary } from '../domain/nutrition.types';

export interface GetDailyCalorieSummaryInput {
  userId: string;
  /** Injected for deterministic tests. Production callers leave unset. */
  now?: Date;
}

function startOfDayUTC(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDayUTC(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.getTime() + 1; // exclusive end
}

export class GetDailyCalorieSummaryUseCase {
  constructor(
    private readonly entryRepository: NutritionEntryRepository,
    private readonly goalRepository: NutritionGoalRepository,
  ) {}

  async execute(input: GetDailyCalorieSummaryInput): Promise<DailySummary> {
    const now = input.now ?? new Date();
    const startMs = startOfDayUTC(now);
    const endMs = endOfDayUTC(now);

    // Parallel reads — both are side-effect free
    const [entries, goal] = await Promise.all([
      this.entryRepository.findByDateRange(input.userId, startMs, endMs),
      this.goalRepository.getGoal(input.userId),
    ]);

    let consumed = 0;
    for (const entry of entries) {
      consumed += entry.totalCalories;
    }

    const calorieGoal = goal?.dailyCalorieGoal ?? null;
    const remaining =
      calorieGoal != null ? calorieGoal - consumed : null;

    return { consumed, goal: calorieGoal, remaining };
  }
}
