// src/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-goal.repository.ts
//
// SQLite-backed implementation of NutritionGoalRepository.
// Per ADR-007 + ADR-011: implements, not extends.
// Per ADR-012: consumes the Drizzle `db` instance.
//
// One-to-one with profiles (PK = user_id).
// Uses upsert pattern: INSERT ... ON CONFLICT DO UPDATE.

import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { nutritionGoals } from '@db/schema';
import type { NutritionGoal } from '@/lib/contexts/nutrition/domain/nutrition.types';

export class SqliteNutritionGoalRepository {
  constructor(private readonly db: Db) {}

  async getGoal(userId: string): Promise<NutritionGoal | null> {
    const rows = await this.db
      .select()
      .from(nutritionGoals)
      .where(eq(nutritionGoals.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.userId,
      dailyCalorieGoal: row.dailyCalorieGoal,
      updatedAt: row.updatedAt,
    };
  }

  async setGoal(userId: string, goal: number | null): Promise<void> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    // Upsert: insert if not exists, update if exists
    await this.db
      .insert(nutritionGoals)
      .values({
        userId,
        dailyCalorieGoal: goal,
        updatedAt: new Date(nowSeconds * 1000),
      })
      .onConflictDoUpdate({
        target: nutritionGoals.userId,
        set: {
          dailyCalorieGoal: goal,
          updatedAt: new Date(nowSeconds * 1000),
        },
      });
  }
}
