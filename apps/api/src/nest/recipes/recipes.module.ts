import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import { LogMealUseCase } from '@/lib/contexts/nutrition/application/log-meal.use-case';
import { RecipesUseCases } from '@/lib/contexts/recipes/application/recipes.use-cases';
import { SqliteRecipeRepository } from '@/lib/contexts/recipes/infrastructure/sqlite/sqlite-recipes.repository';
import { NutritionMealLogAdapter } from '@/lib/contexts/recipes/infrastructure/nutrition/meal-log.adapter';
import type { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import { NutritionModule } from '../nutrition/nutrition.module';
import { DB, PHOTO_STORAGE } from '../tokens';
import { RecipesController } from './recipes.controller';

@Module({
  // One way only (DR-0029): recipes calls into nutrition, never the other way round.
  imports: [NutritionModule],
  controllers: [RecipesController],
  providers: [
    {
      provide: RecipesUseCases,
      useFactory: (db: Db, storage: PhotoStorage | null, logMeal: LogMealUseCase) =>
        new RecipesUseCases(
          new SqliteRecipeRepository(db),
          storage,
          new NutritionMealLogAdapter(logMeal),
        ),
      inject: [DB, PHOTO_STORAGE, LogMealUseCase],
    },
  ],
})
export class RecipesModule {}
