// src/lib/contexts/nutrition/nutrition.composition.ts
//
// Per-context composition root (ADR-010) for the nutrition context.
// Story 5.1 scope: AI analyze endpoint.
// Story 5.3 scope: nutrition entries (save, history, daily summary) + goals.
//
// Pattern (mirrors `private-photos.composition.ts` and
// `workout-tracking.composition.ts`):
//   - Construct the AI adapter at module load.
//   - Wire repos + use cases as lazy singletons.
//   - Export use cases via getter functions.
//
// Round-6 Supabase swap: this file is the only seam.

import { resolve } from 'node:path';
import { db } from '@/lib/db/client';
import { GeminiVisionAdapter } from './infrastructure/ai/gemini-vision.adapter';
import { AnalyzeMealUseCase } from './application/analyze-meal.use-case';
import { SaveNutritionEntryUseCase } from './application/save-nutrition-entry.use-case';
import { GetNutritionHistoryUseCase } from './application/get-nutrition-history.use-case';
import { GetDailyCalorieSummaryUseCase } from './application/get-daily-calorie-summary.use-case';
import { SetCalorieGoalUseCase } from './application/set-calorie-goal.use-case';
import { SqliteNutritionEntryRepository } from './infrastructure/sqlite/sqlite-nutrition-entry.repository';
import { SqliteNutritionGoalRepository } from './infrastructure/sqlite/sqlite-nutrition-goal.repository';
import { AIAnalysisRules } from './domain/nutrition.constants';
import type { NutritionEntryRepository } from './domain/nutrition-entry-repository';
import type { NutritionGoalRepository } from './domain/nutrition-goal-repository';
import type { AnalyzeMealUseCase as AnalyzeMealUseCaseType } from './application/analyze-meal.use-case';
import type { SaveNutritionEntryUseCase as SaveNutritionEntryUseCaseType } from './application/save-nutrition-entry.use-case';
import type { GetNutritionHistoryUseCase as GetNutritionHistoryUseCaseType } from './application/get-nutrition-history.use-case';
import type { GetDailyCalorieSummaryUseCase as GetDailyCalorieSummaryUseCaseType } from './application/get-daily-calorie-summary.use-case';
import type { SetCalorieGoalUseCase as SetCalorieGoalUseCaseType } from './application/set-calorie-goal.use-case';

/**
 * Filesystem root for nutrition photos. Each user's folder lives at
 * `${uploadsRoot}/{userId}/{timestampMs}.{ext}`.
 */
export const uploadsRoot = resolve(process.cwd(), 'uploads', 'nutrition');

// =============================================================
// Repositories (lazy singletons)
// =============================================================

let entryRepositoryInstance: NutritionEntryRepository | null = null;
let goalRepositoryInstance: NutritionGoalRepository | null = null;

export function getNutritionEntryRepository(): NutritionEntryRepository {
  if (!entryRepositoryInstance) {
    entryRepositoryInstance = new SqliteNutritionEntryRepository(db, {
      uploadsRoot,
    });
  }
  return entryRepositoryInstance;
}

export function getNutritionGoalRepository(): NutritionGoalRepository {
  if (!goalRepositoryInstance) {
    goalRepositoryInstance = new SqliteNutritionGoalRepository(db);
  }
  return goalRepositoryInstance;
}

// =============================================================
// Use Cases (lazy singletons)
// =============================================================

let analyzeMealUseCaseInstance: AnalyzeMealUseCaseType | null = null;
let saveNutritionEntryUseCaseInstance: SaveNutritionEntryUseCaseType | null =
  null;
let getNutritionHistoryUseCaseInstance:
  | GetNutritionHistoryUseCaseType
  | null = null;
let getDailyCalorieSummaryUseCaseInstance:
  | GetDailyCalorieSummaryUseCaseType
  | null = null;
let setCalorieGoalUseCaseInstance: SetCalorieGoalUseCaseType | null = null;

function buildAIAdapter(): GeminiVisionAdapter {
  return new GeminiVisionAdapter(apiKey, {
    model: AIAnalysisRules.DefaultModel,
    timeoutMs: AIAnalysisRules.TimeoutMs,
  });
}

const apiKey = process.env.GEMINI_API_KEY ?? '';

export function getAnalyzeMealUseCase(): AnalyzeMealUseCaseType {
  if (!analyzeMealUseCaseInstance) {
    analyzeMealUseCaseInstance = new AnalyzeMealUseCase(buildAIAdapter());
  }
  return analyzeMealUseCaseInstance;
}

export function getSaveNutritionEntryUseCase(): SaveNutritionEntryUseCaseType {
  if (!saveNutritionEntryUseCaseInstance) {
    saveNutritionEntryUseCaseInstance = new SaveNutritionEntryUseCase(
      getNutritionEntryRepository(),
    );
  }
  return saveNutritionEntryUseCaseInstance;
}

export function getGetNutritionHistoryUseCase(): GetNutritionHistoryUseCaseType {
  if (!getNutritionHistoryUseCaseInstance) {
    getNutritionHistoryUseCaseInstance = new GetNutritionHistoryUseCase(
      getNutritionEntryRepository(),
    );
  }
  return getNutritionHistoryUseCaseInstance;
}

export function getGetDailyCalorieSummaryUseCase(): GetDailyCalorieSummaryUseCaseType {
  if (!getDailyCalorieSummaryUseCaseInstance) {
    getDailyCalorieSummaryUseCaseInstance =
      new GetDailyCalorieSummaryUseCase(
        getNutritionEntryRepository(),
        getNutritionGoalRepository(),
      );
  }
  return getDailyCalorieSummaryUseCaseInstance;
}

export function getSetCalorieGoalUseCase(): SetCalorieGoalUseCaseType {
  if (!setCalorieGoalUseCaseInstance) {
    setCalorieGoalUseCaseInstance = new SetCalorieGoalUseCase(
      getNutritionGoalRepository(),
    );
  }
  return setCalorieGoalUseCaseInstance;
}

// =============================================================
// Test seams
// =============================================================

export function __setAnalyzeMealUseCaseForTesting(
  useCase: AnalyzeMealUseCaseType,
): void {
  analyzeMealUseCaseInstance = useCase;
}

export function __setNutritionEntryRepositoryForTesting(
  repo: NutritionEntryRepository,
): void {
  entryRepositoryInstance = repo;
}

export function __setNutritionGoalRepositoryForTesting(
  repo: NutritionGoalRepository,
): void {
  goalRepositoryInstance = repo;
}

export function __resetAllNutritionSingletonsForTesting(): void {
  analyzeMealUseCaseInstance = null;
  saveNutritionEntryUseCaseInstance = null;
  getNutritionHistoryUseCaseInstance = null;
  getDailyCalorieSummaryUseCaseInstance = null;
  setCalorieGoalUseCaseInstance = null;
  entryRepositoryInstance = null;
  goalRepositoryInstance = null;
}