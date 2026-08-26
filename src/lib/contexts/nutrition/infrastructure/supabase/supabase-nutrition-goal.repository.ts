// src/lib/contexts/nutrition/infrastructure/supabase/supabase-nutrition-goal.repository.ts
//
// Supabase-backed implementation of NutritionGoalRepository (story 6.2).
// Per ADR-007 + ADR-011: `implements`, not `extends`.
//
// One-to-one with profiles (PK = user_id). Uses upsert pattern
// (INSERT ... ON CONFLICT DO UPDATE via Supabase `.upsert()`).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NutritionGoal } from '@/lib/contexts/nutrition/domain/nutrition.types';

interface NutritionGoalRow {
  user_id: string;
  daily_calorie_goal: number | null;
  updated_at: string;
}

export class SupabaseNutritionGoalRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getGoal(userId: string): Promise<NutritionGoal | null> {
    const { data, error } = await this.supabase
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch nutrition goal: ${error.message}`);
    }
    if (!data) return null;
    const row = data as NutritionGoalRow;
    return {
      userId: row.user_id,
      dailyCalorieGoal: row.daily_calorie_goal,
      updatedAt: new Date(row.updated_at),
    };
  }

  async setGoal(userId: string, goal: number | null): Promise<void> {
    const { error } = await this.supabase
      .from('nutrition_goals')
      .upsert(
        {
          user_id: userId,
          daily_calorie_goal: goal,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) {
      throw new Error(`Failed to set nutrition goal: ${error.message}`);
    }
  }
}