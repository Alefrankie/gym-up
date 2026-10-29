// src/lib/contexts/nutrition/application/get-nutrition-history.use-case.ts
//
// Use case: fetch user's nutrition entries (newest first).
//
// Per golden-rules: side-effect free read — no DB mutation.

import type { NutritionEntry } from '@db/schema';
import type { NutritionEntryRepository } from '../domain/nutrition-entry-repository';

export interface GetNutritionHistoryInput {
  userId: string;
  limit?: number;
}

export class GetNutritionHistoryUseCase {
  constructor(
    private readonly entryRepository: NutritionEntryRepository,
  ) {}

  async execute(input: GetNutritionHistoryInput): Promise<NutritionEntry[]> {
    const limit = input.limit ?? 50;
    const entries = await this.entryRepository.findByUser(input.userId);
    return entries.slice(0, limit);
  }
}
