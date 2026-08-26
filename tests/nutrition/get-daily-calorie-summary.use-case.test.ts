import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { GetDailyCalorieSummaryUseCase } from '@/lib/contexts/nutrition/application/get-daily-calorie-summary.use-case';
import { SqliteNutritionEntryRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-entry.repository';
import { SqliteNutritionGoalRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-goal.repository';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import { profiles } from '@db/schema';

const TEST_UPLOADS = join(process.cwd(), '.tmp-test-nutrition-daily');

describe('GetDailyCalorieSummaryUseCase', () => {
  let handle: TestDbHandle;
  let useCase: GetDailyCalorieSummaryUseCase;
  let entryRepo: SqliteNutritionEntryRepository;
  let goalRepo: SqliteNutritionGoalRepository;
  let userId: string;

  // "today" derivado de now para que la ventana diaria (UTC) siempre coincida
  // con las entradas creadas sin createdAt explícito (default = Date.now()).
  // Per crew-learning: construir fechas de test desde new Date(), no ISO fijo.
  const today = new Date();
  const todayStartMs = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  ).getTime();
  const todayEndMs = todayStartMs + 86400000;
  const yesterdayMs = todayStartMs - 86400000;

  beforeEach(async () => {
    handle = createTestDb();
    const [u] = await handle.db.insert(profiles).values({ email: 'user-1@test.com', passwordHash: 'h', displayName: 'U1', routineType: 'hombre', weightUnit: 'kg' }).returning();
    userId = u.id;
    mkdirSync(TEST_UPLOADS, { recursive: true });
    entryRepo = new SqliteNutritionEntryRepository(handle.db, { uploadsRoot: TEST_UPLOADS });
    goalRepo = new SqliteNutritionGoalRepository(handle.db);
    useCase = new GetDailyCalorieSummaryUseCase(entryRepo, goalRepo);
  });

  afterEach(() => {
    handle.close();
    rmSync(TEST_UPLOADS, { recursive: true, force: true });
  });

  it('returns zero consumed and null goal for new user', async () => {
    const summary = await useCase.execute({ userId, now: today });
    expect(summary.consumed).toBe(0);
    expect(summary.goal).toBeNull();
    expect(summary.remaining).toBeNull();
  });

  it('sums today entries only', async () => {
    // Yesterday entry (createdAt at 1am yesterday)
    const yesterdayDate = new Date(yesterdayMs + 3600000);
    await entryRepo.create({
      userId,
      storagePath: `${userId}/yesterday.jpg`,
      photoDate: yesterdayMs,
      totalCalories: 300,
      totalProtein: 20,
      totalCarbs: 30,
      totalFat: 10,
      foodItems: [{ name: 'Old', estimated_calories: 300, estimated_protein: 20, estimated_carbs: 30, estimated_fat: 10 }],
      aiRawResponse: null,
      userEdited: false,
      createdAt: yesterdayDate,
    }, userId);
    // Today entry (createdAt at 1am today)
    const todayDate = new Date(todayStartMs + 3600000);
    await entryRepo.create({
      userId,
      storagePath: `${userId}/today.jpg`,
      photoDate: todayStartMs,
      totalCalories: 700,
      totalProtein: 50,
      totalCarbs: 80,
      totalFat: 25,
      foodItems: [{ name: 'Lunch', estimated_calories: 700, estimated_protein: 50, estimated_carbs: 80, estimated_fat: 25 }],
      aiRawResponse: null,
      userEdited: false,
      createdAt: todayDate,
    }, userId);

    const summary = await useCase.execute({ userId, now: today });
    expect(summary.consumed).toBe(700);
  });

  it('calculates remaining when goal is set', async () => {
    await goalRepo.setGoal(userId, 2000);
    await entryRepo.create({
      userId,
      storagePath: `${userId}/today.jpg`,
      photoDate: todayStartMs,
      totalCalories: 1200,
      totalProtein: 80,
      totalCarbs: 120,
      totalFat: 40,
      foodItems: [{ name: 'Meal', estimated_calories: 1200, estimated_protein: 80, estimated_carbs: 120, estimated_fat: 40 }],
      aiRawResponse: null,
      userEdited: false,
    }, userId);

    const summary = await useCase.execute({ userId, now: today });
    expect(summary.goal).toBe(2000);
    expect(summary.consumed).toBe(1200);
    expect(summary.remaining).toBe(800);
  });

  it('returns negative remaining when over goal', async () => {
    await goalRepo.setGoal(userId, 1000);
    await entryRepo.create({
      userId,
      storagePath: `${userId}/today.jpg`,
      photoDate: todayStartMs,
      totalCalories: 1500,
      totalProtein: 100,
      totalCarbs: 150,
      totalFat: 50,
      foodItems: [{ name: 'Big Meal', estimated_calories: 1500, estimated_protein: 100, estimated_carbs: 150, estimated_fat: 50 }],
      aiRawResponse: null,
      userEdited: false,
    }, userId);

    const summary = await useCase.execute({ userId, now: today });
    expect(summary.remaining).toBe(-500);
  });
});
