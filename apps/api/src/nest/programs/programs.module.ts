import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import { GetNextWorkoutUseCase } from '@/lib/contexts/routines/application/get-next-workout.use-case';
import {
  ActivateProgramUseCase,
  AdoptProgramUseCase,
  ArchiveProgramUseCase,
  CreateProgramUseCase,
  GetProgramUseCase,
  ListProgramsUseCase,
  SaveProgramUseCase,
} from '@/lib/contexts/routines/application/program.use-cases';
import { ProgramRepository } from '@/lib/contexts/routines/domain/program.repository';
import { SqliteProgramRepository } from '@/lib/contexts/routines/infrastructure/sqlite/sqlite-program.repository';
import { WorkoutRepository } from '@/lib/contexts/workout-tracking/domain/workout.repository';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository';
import { DB } from '../tokens';
import { ProgramsController } from './programs.controller';

const useCase = <T>(Ctor: new (r: ProgramRepository) => T) => ({
  provide: Ctor,
  useFactory: (r: ProgramRepository) => new Ctor(r),
  inject: [ProgramRepository],
});

@Module({
  controllers: [ProgramsController],
  providers: [
    { provide: ProgramRepository, useFactory: (db: Db) => new SqliteProgramRepository(db), inject: [DB] },
    { provide: WorkoutRepository, useFactory: (db: Db) => new SqliteWorkoutRepository(db), inject: [DB] },
    useCase(ListProgramsUseCase),
    useCase(GetProgramUseCase),
    useCase(AdoptProgramUseCase),
    useCase(CreateProgramUseCase),
    useCase(SaveProgramUseCase),
    useCase(ArchiveProgramUseCase),
    useCase(ActivateProgramUseCase),
    {
      provide: GetNextWorkoutUseCase,
      useFactory: (p: ProgramRepository, w: WorkoutRepository, a: AdoptProgramUseCase) => new GetNextWorkoutUseCase(p, w, a),
      inject: [ProgramRepository, WorkoutRepository, AdoptProgramUseCase],
    },
  ],
  exports: [GetNextWorkoutUseCase],
})
export class ProgramsModule {}
