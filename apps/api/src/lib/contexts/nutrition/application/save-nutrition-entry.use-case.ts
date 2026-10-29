// src/lib/contexts/nutrition/application/save-nutrition-entry.use-case.ts
//
// Use case: save an analyzed meal (photo + nutrition data).
//
// Pipeline:
//   1. Validate inputs (photo size, format, macros, foodItems).
//   2. Build storagePath from (userId, photoDate, format).
//   3. Write real bytes to disk FIRST.
//   4. Create DB row via repository.
//   5. If DB fails → delete the file (orphan guard, cat 5).

import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { NutritionEntry } from '@db/schema';
import type { NutritionEntryRepository } from '../domain/nutrition-entry-repository';
import type { PhotoFormat } from '../domain/nutrition.types';
import {
  PhotoRules,
  buildNutritionStoragePath,
} from '../domain/nutrition.constants';
import {
  PhotoSizeExceededError,
  UnsupportedPhotoFormatError,
  InvalidNutritionDataError,
  EmptyFoodItemsError,
} from '../domain/errors';

export interface SaveNutritionEntryInput {
  userId: string;
  format: PhotoFormat;
  imageBytes: Uint8Array;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  foodItems: Array<{
    name: string;
    estimated_calories: number;
    estimated_protein: number;
    estimated_carbs: number;
    estimated_fat: number;
  }>;
  aiRawResponse: Record<string, unknown> | null;
  userEdited: boolean;
  photoDate?: Date;
  uploadsRoot: string;
}

export interface SaveNutritionEntryResult {
  entry: NutritionEntry;
  absolutePath: string;
  bytesWritten: number;
}

export class SaveNutritionEntryUseCase {
  constructor(
    private readonly entryRepository: NutritionEntryRepository,
  ) {}

  async execute(
    input: SaveNutritionEntryInput,
  ): Promise<SaveNutritionEntryResult> {
    this.validate(input);

    const photoDate = input.photoDate ?? new Date();
    const photoDateMs = photoDate.getTime();
    const storagePath = buildNutritionStoragePath(
      input.userId,
      photoDateMs,
      input.format,
    );
    const absolutePath = join(input.uploadsRoot, storagePath);

    // Write bytes to disk FIRST
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, input.imageBytes);

    try {
      const entry = await this.entryRepository.create(
        {
          userId: input.userId,
          storagePath,
          photoDate: photoDateMs,
          totalCalories: input.totalCalories,
          totalProtein: input.totalProtein,
          totalCarbs: input.totalCarbs,
          totalFat: input.totalFat,
          foodItems: input.foodItems,
          aiRawResponse: input.aiRawResponse,
          userEdited: input.userEdited,
        },
        input.userId,
      );

      return { entry, absolutePath, bytesWritten: input.imageBytes.length };
    } catch (err) {
      // Orphan guard: if DB write fails, clean up the file on disk
      try {
        unlinkSync(absolutePath);
      } catch {
        // Best-effort cleanup; don't mask the original error
      }
      throw err;
    }
  }

  private validate(input: SaveNutritionEntryInput): void {
    // Photo size validation (defense in depth — client already compressed)
    if (input.imageBytes.length > PhotoRules.MaxSizeBytes) {
      throw new PhotoSizeExceededError(input.imageBytes.length);
    }

    // Format validation
    const supported = PhotoRules.AcceptedFormats as readonly string[];
    if (!supported.includes(input.format)) {
      throw new UnsupportedPhotoFormatError(input.format);
    }

    // Numeric validations
    if (input.totalCalories < 0) {
      throw new InvalidNutritionDataError('totalCalories must be >= 0');
    }
    if (input.totalProtein < 0) {
      throw new InvalidNutritionDataError('totalProtein must be >= 0');
    }
    if (input.totalCarbs < 0) {
      throw new InvalidNutritionDataError('totalCarbs must be >= 0');
    }
    if (input.totalFat < 0) {
      throw new InvalidNutritionDataError('totalFat must be >= 0');
    }

    // foodItems validation
    if (!input.foodItems || input.foodItems.length === 0) {
      throw new EmptyFoodItemsError();
    }
    for (const item of input.foodItems) {
      if (!item.name || item.name.trim().length === 0) {
        throw new InvalidNutritionDataError('Each food item must have a name');
      }
      if (item.estimated_calories < 0) {
        throw new InvalidNutritionDataError(
          `Food item "${item.name}" has negative calories`,
        );
      }
    }
  }
}
