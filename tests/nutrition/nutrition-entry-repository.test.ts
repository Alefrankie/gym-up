import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import { SqliteNutritionEntryRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-entry.repository';
import { NutritionEntryOwnershipError } from '@/lib/contexts/nutrition/domain/nutrition-entry-repository';
import type { NutritionEntryCreateDTO } from '@/lib/contexts/nutrition/domain/nutrition.types';
import { profiles } from '@db/schema';

const TEST_UPLOADS = join(process.cwd(), '.tmp-test-nutrition-uploads');

describe('SqliteNutritionEntryRepository', () => {
  let handle: TestDbHandle;
  let repo: SqliteNutritionEntryRepository;
  let userId1: string;
  let userId2: string;

  beforeEach(async () => {
    handle = createTestDb();
    const [u1] = await handle.db.insert(profiles).values({ email: 'user-1@test.com', passwordHash: 'h', displayName: 'U1', routineType: 'hombre', weightUnit: 'kg' }).returning();
    const [u2] = await handle.db.insert(profiles).values({ email: 'user-2@test.com', passwordHash: 'h', displayName: 'U2', routineType: 'mujer', weightUnit: 'lbs' }).returning();
    userId1 = u1.id;
    userId2 = u2.id;
    mkdirSync(TEST_UPLOADS, { recursive: true });
    repo = new SqliteNutritionEntryRepository(handle.db, { uploadsRoot: TEST_UPLOADS });
  });

  afterEach(() => {
    handle.close();
    rmSync(TEST_UPLOADS, { recursive: true, force: true });
  });

  function makeInput(overrides: Partial<NutritionEntryCreateDTO> = {}): NutritionEntryCreateDTO {
    return {
      userId: userId1,
      storagePath: `${userId1}/1234567890.jpg`,
      photoDate: 1234567890000,
      totalCalories: 500,
      totalProtein: 30,
      totalCarbs: 50,
      totalFat: 20,
      foodItems: [{ name: 'Test Food', estimated_calories: 500, estimated_protein: 30, estimated_carbs: 50, estimated_fat: 20 }],
      aiRawResponse: null,
      userEdited: false,
      ...overrides,
    };
  }

  it('creates and retrieves an entry', async () => {
    const input = makeInput();
    const created = await repo.create(input, userId1);
    expect(created.id).toBeDefined();
    expect(created.userId).toBe(userId1);
    expect(created.totalCalories).toBe(500);

    const found = await repo.findById(created.id, userId1);
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });

  it('throws NutritionEntryOwnershipError on cross-user findById', async () => {
    const created = await repo.create(makeInput(), userId1);
    await expect(repo.findById(created.id, userId2)).rejects.toThrow(NutritionEntryOwnershipError);
  });

  it('findByUser returns entries newest first', async () => {
    const now = Date.now();
    const oldDate = new Date(now - 10000);
    const newDate = new Date(now);
    await repo.create(makeInput({ storagePath: `${userId1}/old.jpg`, photoDate: now - 10000, totalCalories: 300, createdAt: oldDate }), userId1);
    await repo.create(makeInput({ storagePath: `${userId1}/new.jpg`, photoDate: now, totalCalories: 700, createdAt: newDate }), userId1);
    const entries = await repo.findByUser(userId1);
    expect(entries).toHaveLength(2);
    expect(entries[0].totalCalories).toBe(700);
    expect(entries[1].totalCalories).toBe(300);
  });

  it('findByDateRange filters by date', async () => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    const yesterdayDate = new Date(todayMs - 86400000);
    const todayDate = new Date(todayMs + 3600000); // 1am today

    await repo.create(makeInput({ storagePath: `${userId1}/yesterday.jpg`, photoDate: todayMs - 86400000, totalCalories: 300, createdAt: yesterdayDate }), userId1);
    await repo.create(makeInput({ storagePath: `${userId1}/today.jpg`, photoDate: todayMs, totalCalories: 700, createdAt: todayDate }), userId1);

    const todayEntries = await repo.findByDateRange(userId1, todayMs, todayMs + 86400000);
    expect(todayEntries).toHaveLength(1);
    expect(todayEntries[0].totalCalories).toBe(700);
  });

  it('deletes entry and file from disk', async () => {
    const input = makeInput();
    const created = await repo.create(input, userId1);
    const filePath = join(TEST_UPLOADS, created.storagePath);
    writeFileSync(filePath, 'fake-image-bytes');

    await repo.delete(created.id, userId1);
    const found = await repo.findById(created.id, userId1);
    expect(found).toBeUndefined();
  });

  it('throws on create with mismatched userId', async () => {
    await expect(repo.create(makeInput({ userId: userId2 }), userId1)).rejects.toThrow(NutritionEntryOwnershipError);
  });
});
