// src/lib/contexts/nutrition/domain/nutrition-goal-repository.ts
//
// Abstract contract for nutrition goal persistence.
//
// One-to-one with profiles (PK = user_id).
// Per ADR-007 + ADR-011: abstract class for TS-native contract.
//
// NOTE on null semantics (DDD exception documented):
//   `getGoal(userId)` returns `null` when the user has never set a goal.
//   This is NOT an error — it represents "absence of configuration".
//   Golden rule "Repositories return aggregates or throw" is relaxed here
//   because `null` has explicit domain meaning (unset ≠ not found).

import type { NutritionGoal } from './nutrition.types';

export abstract class NutritionGoalRepository {
  /**
   * Get the user's calorie goal. Returns `null` when unset (not an error).
   */
  abstract getGoal(userId: string): Promise<NutritionGoal | null>;

  /**
   * Set or clear the user's calorie goal. Pass `null` to clear.
   */
  abstract setGoal(
    userId: string,
    goal: number | null,
  ): Promise<void>;
}
