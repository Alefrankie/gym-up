import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { SaveNutritionEntryUseCase } from '@/lib/contexts/nutrition/application/save-nutrition-entry.use-case';
import { SqliteNutritionEntryRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-entry.repository';
import { createTestDb, type TestDbHandle } from '../workout-tracking/test-db';
import {
  PhotoSizeExceededError,
  UnsupportedPhotoFormatError,
  InvalidNutritionDataError,
  EmptyFoodItemsError,
} from '@/lib/contexts/nutrition/domain/errors';
import { profiles } from '@db/schema';

const TEST_UPLOADS = join(process.cwd(), '.tmp-test-nutrition-save');

describe('SaveNutritionEntryUseCase', () => {
  let handle: TestDbHandle;
  let useCase: SaveNutritionEntryUseCase;
  let userId: string;

  beforeEach(async () => {
    handle = createTestDb();
    const [u] = await handle.db.insert(profiles).values({ email: 'user-1@test.com', passwordHash: 'h', displayName: 'U1', routineType: 'hombre', weightUnit: 'kg' }).returning();
    userId = u.id;
    mkdirSync(TEST_UPLOADS, { recursive: true });
    const repo = new SqliteNutritionEntryRepository(handle.db, { uploadsRoot: TEST_UPLOADS });
    useCase = new SaveNutritionEntryUseCase(repo);
  });

  afterEach(() => {
    handle.close();
    rmSync(TEST_UPLOADS, { recursive: true, force: true });
  });

  it('saves entry with photo bytes to disk + DB', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // fake JPEG header
    const result = await useCase.execute({
      userId,
      format: 'jpg',
      imageBytes: bytes,
      totalCalories: 600,
      totalProtein: 40,
      totalCarbs: 60,
      totalFat: 25,
      foodItems: [{ name: 'Chicken', estimated_calories: 600, estimated_protein: 40, estimated_carbs: 60, estimated_fat: 25 }],
      aiRawResponse: null,
      userEdited: false,
      uploadsRoot: TEST_UPLOADS,
    });

    expect(result.entry.id).toBeDefined();
    expect(result.entry.totalCalories).toBe(600);
    expect(result.bytesWritten).toBe(4);
    expect(existsSync(result.absolutePath)).toBe(true);
  });

  it('rejects photo exceeding 5MB', async () => {
    const bigBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    await expect(useCase.execute({
      userId,
      format: 'jpg',
      imageBytes: bigBytes,
      totalCalories: 100,
      totalProtein: 10,
      totalCarbs: 10,
      totalFat: 5,
      foodItems: [{ name: 'X', estimated_calories: 100, estimated_protein: 10, estimated_carbs: 10, estimated_fat: 5 }],
      aiRawResponse: null,
      userEdited: false,
      uploadsRoot: TEST_UPLOADS,
    })).rejects.toThrow(PhotoSizeExceededError);
  });

  it('rejects unsupported format', async () => {
    await expect(useCase.execute({
      userId,
      format: 'gif' as any,
      imageBytes: new Uint8Array(10),
      totalCalories: 100,
      totalProtein: 10,
      totalCarbs: 10,
      totalFat: 5,
      foodItems: [{ name: 'X', estimated_calories: 100, estimated_protein: 10, estimated_carbs: 10, estimated_fat: 5 }],
      aiRawResponse: null,
      userEdited: false,
      uploadsRoot: TEST_UPLOADS,
    })).rejects.toThrow(UnsupportedPhotoFormatError);
  });

  it('rejects empty food items', async () => {
    await expect(useCase.execute({
      userId,
      format: 'jpg',
      imageBytes: new Uint8Array(10),
      totalCalories: 100,
      totalProtein: 10,
      totalCarbs: 10,
      totalFat: 5,
      foodItems: [],
      aiRawResponse: null,
      userEdited: false,
      uploadsRoot: TEST_UPLOADS,
    })).rejects.toThrow(EmptyFoodItemsError);
  });

  it('rejects negative calories', async () => {
    await expect(useCase.execute({
      userId,
      format: 'jpg',
      imageBytes: new Uint8Array(10),
      totalCalories: -1,
      totalProtein: 10,
      totalCarbs: 10,
      totalFat: 5,
      foodItems: [{ name: 'X', estimated_calories: 100, estimated_protein: 10, estimated_carbs: 10, estimated_fat: 5 }],
      aiRawResponse: null,
      userEdited: false,
      uploadsRoot: TEST_UPLOADS,
    })).rejects.toThrow(InvalidNutritionDataError);
  });

  it('persists user_edited flag', async () => {
    const result = await useCase.execute({
      userId,
      format: 'jpg',
      imageBytes: new Uint8Array(10),
      totalCalories: 400,
      totalProtein: 25,
      totalCarbs: 45,
      totalFat: 15,
      foodItems: [{ name: 'Salad', estimated_calories: 400, estimated_protein: 25, estimated_carbs: 45, estimated_fat: 15 }],
      aiRawResponse: { provider: 'gemini' },
      userEdited: true,
      uploadsRoot: TEST_UPLOADS,
    });

    expect(result.entry.userEdited).toBe(true);
    expect(result.entry.aiRawResponse).toContain('gemini');
  });
});
