import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SetCalorieGoalUseCase } from '@/lib/contexts/nutrition/application/set-calorie-goal.use-case';
import { InvalidCalorieGoalError } from '@/lib/contexts/nutrition/domain/errors';
import { CalorieGoalRules } from '@/lib/contexts/nutrition/domain/nutrition.constants';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import { SqliteNutritionGoalRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-goal.repository';
import { profiles } from '@db/schema';

describe('SetCalorieGoalUseCase', () => {
  let handle: TestDbHandle;
  let useCase: SetCalorieGoalUseCase;
  let userId1: string;

  beforeEach(async () => {
    handle = createTestDb();
    const [u1] = await handle.db.insert(profiles).values({ email: 'user-1@test.com', passwordHash: 'h', displayName: 'U1', routineType: 'hombre', weightUnit: 'kg' }).returning();
    userId1 = u1.id;
    const goalRepo = new SqliteNutritionGoalRepository(handle.db);
    useCase = new SetCalorieGoalUseCase(goalRepo);
  });

  afterEach(() => {
    handle.close();
  });

  it('sets a valid calorie goal', async () => {
    await useCase.execute({ userId: userId1, goal: 2000 });
    const goalRepo = new SqliteNutritionGoalRepository(handle.db);
    const goal = await goalRepo.getGoal(userId1);
    expect(goal?.dailyCalorieGoal).toBe(2000);
  });

  it('clears goal by setting null', async () => {
    await useCase.execute({ userId: userId1, goal: 2000 });
    await useCase.execute({ userId: userId1, goal: null });
    const goalRepo = new SqliteNutritionGoalRepository(handle.db);
    const goal = await goalRepo.getGoal(userId1);
    expect(goal?.dailyCalorieGoal).toBeNull();
  });

  it('rejects goal below minimum', async () => {
    await expect(useCase.execute({ userId: userId1, goal: 0 })).rejects.toThrow(InvalidCalorieGoalError);
  });

  it('rejects goal above maximum', async () => {
    await expect(useCase.execute({ userId: userId1, goal: 10001 })).rejects.toThrow(InvalidCalorieGoalError);
  });

  it('rejects non-integer goal', async () => {
    await expect(useCase.execute({ userId: userId1, goal: 1500.5 })).rejects.toThrow(InvalidCalorieGoalError);
  });

  it('accepts boundary values', async () => {
    await useCase.execute({ userId: userId1, goal: CalorieGoalRules.Min });
    await useCase.execute({ userId: userId1, goal: CalorieGoalRules.Max });
    const goalRepo = new SqliteNutritionGoalRepository(handle.db);
    const goal = await goalRepo.getGoal(userId1);
    expect(goal?.dailyCalorieGoal).toBe(CalorieGoalRules.Max);
  });
});
