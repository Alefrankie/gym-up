import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/calculate-streak.use-case';
import { GetCalendarDataUseCase } from '@/lib/contexts/progress/application/get-calendar-data.use-case';
import { GetExerciseHistoryUseCase } from '@/lib/contexts/progress/application/get-exercise-history.use-case';
import { GetExerciseListUseCase } from '@/lib/contexts/progress/application/get-exercise-list.use-case';
import { ExerciseQueryRepository } from '@/lib/contexts/progress/domain/ports/ExerciseQueryRepository';
import { ProgressRepository } from '@/lib/contexts/progress/domain/ports/ProgressRepository';
import { SqliteExerciseQueryRepository } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-exercise-query.repository';
import { SqliteProgressRepository } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-progress.repository';
import { DB } from '../tokens';
import { ProgressController } from './progress.controller';

@Module({
  controllers: [ProgressController],
  providers: [
    { provide: ProgressRepository, useFactory: (db: Db) => new SqliteProgressRepository(db), inject: [DB] },
    { provide: ExerciseQueryRepository, useFactory: (db: Db) => new SqliteExerciseQueryRepository(db), inject: [DB] },
    { provide: GetExerciseListUseCase, useFactory: (r: ExerciseQueryRepository) => new GetExerciseListUseCase(r), inject: [ExerciseQueryRepository] },
    { provide: GetExerciseHistoryUseCase, useFactory: (r: ProgressRepository) => new GetExerciseHistoryUseCase(r), inject: [ProgressRepository] },
    { provide: CalculateStreakUseCase, useFactory: (r: ProgressRepository) => new CalculateStreakUseCase(r), inject: [ProgressRepository] },
    { provide: GetCalendarDataUseCase, useFactory: (r: ProgressRepository) => new GetCalendarDataUseCase(r), inject: [ProgressRepository] },
  ],
  exports: [CalculateStreakUseCase],
})
export class ProgressModule {}
