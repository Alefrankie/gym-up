import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import { CompleteWorkoutUseCase } from '@/lib/contexts/workout-tracking/application/complete-workout.use-case';
import { GetWorkoutDetailUseCase } from '@/lib/contexts/workout-tracking/application/get-workout-detail.use-case';
import { GetWorkoutHistoryUseCase } from '@/lib/contexts/workout-tracking/application/get-workout-history.use-case';
import { LogSetUseCase } from '@/lib/contexts/workout-tracking/application/log-set.use-case';
import { StartWorkoutUseCase } from '@/lib/contexts/workout-tracking/application/start-workout.use-case';
import { RoutineRepository } from '@/lib/contexts/workout-tracking/domain/routine.repository';
import { WorkoutRepository } from '@/lib/contexts/workout-tracking/domain/workout.repository';
import { SqliteRoutineRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import { ProgramsModule } from '../programs/programs.module';
import { DB } from '../tokens';
import { WorkoutsController } from './workouts.controller';

/**
 * Replaces the per-context composition root (ADR-010): the domain classes stay free of
 * Nest decorators and are bound here with factories (ADR-011: abstract classes as tokens).
 */
@Module({
  imports: [ProgramsModule],
  controllers: [WorkoutsController],
  providers: [
    { provide: WorkoutRepository, useFactory: (db: Db) => new SqliteWorkoutRepository(db), inject: [DB] },
    { provide: RoutineRepository, useFactory: (db: Db) => new SqliteRoutineRepository(db), inject: [DB] },
    {
      provide: StartWorkoutUseCase,
      useFactory: (routines: RoutineRepository, workouts: WorkoutRepository) => new StartWorkoutUseCase(routines, workouts),
      inject: [RoutineRepository, WorkoutRepository],
    },
    { provide: LogSetUseCase, useFactory: (w: WorkoutRepository) => new LogSetUseCase(w), inject: [WorkoutRepository] },
    { provide: CompleteWorkoutUseCase, useFactory: (w: WorkoutRepository) => new CompleteWorkoutUseCase(w), inject: [WorkoutRepository] },
    { provide: GetWorkoutDetailUseCase, useFactory: (w: WorkoutRepository) => new GetWorkoutDetailUseCase(w), inject: [WorkoutRepository] },
    { provide: GetWorkoutHistoryUseCase, useFactory: (w: WorkoutRepository) => new GetWorkoutHistoryUseCase(w), inject: [WorkoutRepository] },
  ],
})
export class WorkoutsModule {}
