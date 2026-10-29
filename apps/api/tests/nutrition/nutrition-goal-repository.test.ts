import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import { SqliteNutritionGoalRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-goal.repository';
import { profiles } from '@db/schema';

describe('SqliteNutritionGoalRepository', () => {
  let handle: TestDbHandle;
  let repo: SqliteNutritionGoalRepository;
  let userId1: string;
  let userId2: string;

  beforeEach(async () => {
    handle = createTestDb();
    const [u1] = await handle.db.insert(profiles).values({ email: 'user-1@test.com', passwordHash: 'h', displayName: 'U1', routineType: 'hombre', weightUnit: 'kg' }).returning();
    const [u2] = await handle.db.insert(profiles).values({ email: 'user-2@test.com', passwordHash: 'h', displayName: 'U2', routineType: 'mujer', weightUnit: 'lbs' }).returning();
    userId1 = u1.id;
    userId2 = u2.id;
    repo = new SqliteNutritionGoalRepository(handle.db);
  });

  afterEach(() => {
    handle.close();
  });

  it('returns null when no goal set', async () => {
    const goal = await repo.getGoal(userId1);
    expect(goal).toBeNull();
  });

  it('creates and retrieves a goal', async () => {
    await repo.setGoal(userId1, 2000);
    const goal = await repo.getGoal(userId1);
    expect(goal).not.toBeNull();
    expect(goal?.userId).toBe(userId1);
    expect(goal?.dailyCalorieGoal).toBe(2000);
  });

  it('updates existing goal (upsert)', async () => {
    await repo.setGoal(userId1, 2000);
    await repo.setGoal(userId1, 2500);
    const goal = await repo.getGoal(userId1);
    expect(goal?.dailyCalorieGoal).toBe(2500);
  });

  it('clears goal to null', async () => {
    await repo.setGoal(userId1, 2000);
    await repo.setGoal(userId1, null);
    const goal = await repo.getGoal(userId1);
    expect(goal?.dailyCalorieGoal).toBeNull();
  });

  it('isolates goals per user', async () => {
    await repo.setGoal(userId1, 1800);
    await repo.setGoal(userId2, 2500);
    const goal1 = await repo.getGoal(userId1);
    const goal2 = await repo.getGoal(userId2);
    expect(goal1?.dailyCalorieGoal).toBe(1800);
    expect(goal2?.dailyCalorieGoal).toBe(2500);
  });
});
