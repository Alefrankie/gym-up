// src/lib/contexts/nutrition/application/set-calorie-goal.use-case.ts
//
// Use case: set or clear the user's daily calorie goal.
//
// Per golden-rules: application services orchestrate — no business
// logic in services EXCEPT validation (which is a boundary concern).

import type { NutritionGoalRepository } from '../domain/nutrition-goal-repository';
import { CalorieGoalRules } from '../domain/nutrition.constants';
import { InvalidCalorieGoalError } from '../domain/errors';

export interface SetCalorieGoalInput {
  userId: string;
  goal: number | null;
}

export class SetCalorieGoalUseCase {
  constructor(
    private readonly goalRepository: NutritionGoalRepository,
  ) {}

  async execute(input: SetCalorieGoalInput): Promise<void> {
    if (input.goal != null) {
      if (
        !Number.isInteger(input.goal) ||
        input.goal < CalorieGoalRules.Min ||
        input.goal > CalorieGoalRules.Max
      ) {
        throw new InvalidCalorieGoalError(input.goal);
      }
    }

    await this.goalRepository.setGoal(input.userId, input.goal);
  }
}
