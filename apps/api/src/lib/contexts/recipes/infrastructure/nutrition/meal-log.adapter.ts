// src/lib/contexts/recipes/infrastructure/nutrition/meal-log.adapter.ts
//
// Adapts the recipe book's `MealLogPort` onto nutrition's `LogMealUseCase`. This is the only file in
// `recipes` that mentions `nutrition`, and it is deliberately on the infrastructure edge: the application
// layer depends on the port, never on this.

import { LogMealUseCase } from '@/lib/contexts/nutrition/application/log-meal.use-case';
import { toEntryDto } from '@/nest/nutrition/nutrition.mappers';
import { MealLogPort, type LoggedMeal, type MealLogInput } from '../../domain/ports/meal-log.port';

export class NutritionMealLogAdapter extends MealLogPort {
  constructor(private readonly logMeal: LogMealUseCase) {
    super();
  }

  async log(input: MealLogInput): Promise<LoggedMeal> {
    const { entry } = await this.logMeal.execute({
      userId: input.userId,
      id: input.entryId,
      totalCalories: input.totalCalories,
      totalProtein: input.totalProtein,
      totalCarbs: input.totalCarbs,
      totalFat: input.totalFat,
      // A recipe is typed by hand, so the entry counts as user-edited: it is not an AI estimate.
      userEdited: true,
      foodItems: input.foodItems.map((f) => ({
        name: f.name,
        estimated_calories: f.calories,
        estimated_protein: f.protein,
        estimated_carbs: f.carbs,
        estimated_fat: f.fat,
      })),
    });
    return toEntryDto(entry);
  }
}
