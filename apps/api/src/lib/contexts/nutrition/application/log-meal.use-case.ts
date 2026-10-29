// src/lib/contexts/nutrition/application/log-meal.use-case.ts
//
// Saves an analyzed meal: the nutrition entry row plus, optionally, the meal photo in the object store.
// Idempotent by client-generated id (ADR-025): replaying the same request returns the stored entry.
// Replaces the filesystem-based SaveNutritionEntryUseCase (ADR-027).

import type { NutritionEntry } from '@db/schema';
import { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import type { NutritionEntryRepository } from '../domain/nutrition-entry-repository';
import { ContentTypes, type FoodItem, type PhotoFormat } from '../domain/nutrition.types';

export interface LogMealInput {
  userId: string;
  id: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  foodItems: FoodItem[];
  userEdited: boolean;
  aiRawResponse?: Record<string, unknown> | null;
  image?: { bytes: Uint8Array; format: PhotoFormat };
  photoDate?: Date;
}

export const mealKey = (userId: string, id: string, format: PhotoFormat) => `meals/${userId}/${id}.${format}`;

export function formatOfMealKey(storagePath: string): PhotoFormat | null {
  const ext = storagePath.split('.').pop() as PhotoFormat;
  return ext in ContentTypes ? ext : null;
}

export class LogMealUseCase {
  constructor(
    private readonly entries: NutritionEntryRepository,
    /** Null when no bucket is configured: the entry is saved without its photo. */
    private readonly storage: PhotoStorage | null,
  ) {}

  async execute(input: LogMealInput): Promise<{ entry: NutritionEntry; created: boolean }> {
    const existing = await this.entries.findById(input.id, input.userId).catch(() => undefined);
    if (existing) return { entry: existing, created: false };

    let storagePath = '';
    if (input.image && this.storage) {
      storagePath = mealKey(input.userId, input.id, input.image.format);
      await this.storage.put(storagePath, input.image.bytes, ContentTypes[input.image.format]);
    }
    try {
      const entry = await this.entries.create(
        {
          id: input.id,
          userId: input.userId,
          storagePath,
          photoDate: (input.photoDate ?? new Date()).getTime(),
          totalCalories: Math.round(input.totalCalories),
          totalProtein: Math.round(input.totalProtein),
          totalCarbs: Math.round(input.totalCarbs),
          totalFat: Math.round(input.totalFat),
          foodItems: input.foodItems,
          aiRawResponse: input.aiRawResponse ?? null,
          userEdited: input.userEdited,
        },
        input.userId,
      );
      return { entry, created: true };
    } catch (err) {
      if (storagePath && this.storage) await this.storage.delete(storagePath);
      throw err;
    }
  }
}
