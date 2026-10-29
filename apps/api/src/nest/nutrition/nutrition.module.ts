import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import { AnalyzeMealUseCase } from '@/lib/contexts/nutrition/application/analyze-meal.use-case';
import { GetDailyCalorieSummaryUseCase } from '@/lib/contexts/nutrition/application/get-daily-calorie-summary.use-case';
import { GetNutritionHistoryUseCase } from '@/lib/contexts/nutrition/application/get-nutrition-history.use-case';
import { LogMealUseCase } from '@/lib/contexts/nutrition/application/log-meal.use-case';
import { SetCalorieGoalUseCase } from '@/lib/contexts/nutrition/application/set-calorie-goal.use-case';
import { NutritionEntryRepository } from '@/lib/contexts/nutrition/domain/nutrition-entry-repository';
import { NutritionGoalRepository } from '@/lib/contexts/nutrition/domain/nutrition-goal-repository';
import { AIAnalysisPort } from '@/lib/contexts/nutrition/domain/ports/ai-analysis.port';
import { InMemoryAIAnalysisAdapter } from '@/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter';
import { SqliteNutritionEntryRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-entry.repository';
import { SqliteNutritionGoalRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-goal.repository';
import type { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import { AI_ANALYSIS, AI_PORT, DB, PHOTO_STORAGE } from '../tokens';
import { NutritionController } from './nutrition.controller';

@Module({
  controllers: [NutritionController],
  providers: [
    // AI_ANALYSIS tells the controller whether a real provider is bound; AI_PORT is the port itself.
    { provide: AI_ANALYSIS, useFactory: (port: AIAnalysisPort | null) => port !== null, inject: [AI_PORT] },
    { provide: NutritionEntryRepository, useFactory: (db: Db) => new SqliteNutritionEntryRepository(db) as unknown as NutritionEntryRepository, inject: [DB] },
    { provide: NutritionGoalRepository, useFactory: (db: Db) => new SqliteNutritionGoalRepository(db) as unknown as NutritionGoalRepository, inject: [DB] },
    { provide: AnalyzeMealUseCase, useFactory: (p: AIAnalysisPort | null) => new AnalyzeMealUseCase(p ?? new InMemoryAIAnalysisAdapter()), inject: [AI_PORT] },
    { provide: LogMealUseCase, useFactory: (e: NutritionEntryRepository, s: PhotoStorage | null) => new LogMealUseCase(e, s), inject: [NutritionEntryRepository, PHOTO_STORAGE] },
    { provide: GetNutritionHistoryUseCase, useFactory: (e: NutritionEntryRepository) => new GetNutritionHistoryUseCase(e), inject: [NutritionEntryRepository] },
    { provide: GetDailyCalorieSummaryUseCase, useFactory: (e: NutritionEntryRepository, g: NutritionGoalRepository) => new GetDailyCalorieSummaryUseCase(e, g), inject: [NutritionEntryRepository, NutritionGoalRepository] },
    { provide: SetCalorieGoalUseCase, useFactory: (g: NutritionGoalRepository) => new SetCalorieGoalUseCase(g), inject: [NutritionGoalRepository] },
  ],
})
export class NutritionModule {}
