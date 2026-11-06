// src/lib/contexts/recipes/domain/ports/meal-log.port.ts
//
// The one thing `recipes` needs from `nutrition`: "add this as a meal today". The dependency is one way
// (DR-0029) — `nutrition` never learns that recipes exist — so the port belongs to the caller and the
// adapter to the callee's side of the boundary.
//
// The shapes here are the caller's own: the recipe book has no business knowing how a nutrition entry is
// stored, nor the snake_case field names the AI adapter happens to use.

export interface MealLogItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealLogInput {
  userId: string;
  /** Client-generated, so replaying the same request returns the same entry (ADR-025). */
  entryId: string;
  /** Already scaled by the servings eaten. */
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  foodItems: MealLogItem[];
}

/** The entry as the log screen reads it: the same shape the photo-based log returns. */
export interface LoggedMeal {
  id: string;
  loggedAt: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  foodItems: MealLogItem[];
  userEdited: boolean;
  hasPhoto: boolean;
}

export abstract class MealLogPort {
  abstract log(input: MealLogInput): Promise<LoggedMeal>;
}
