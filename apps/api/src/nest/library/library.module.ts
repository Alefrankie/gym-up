import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import {
  ArchiveCustomExerciseUseCase,
  CreateCustomExerciseUseCase,
  GetExerciseUseCase,
  ListExercisesUseCase,
  UpdateCustomExerciseUseCase,
} from '@/lib/contexts/exercise-library/application/exercise-library.use-cases';
import { ExerciseLibraryRepository } from '@/lib/contexts/exercise-library/domain/exercise-library.repository';
import { SqliteExerciseLibraryRepository } from '@/lib/contexts/exercise-library/infrastructure/sqlite/sqlite-exercise-library.repository';
import { DB } from '../tokens';
import { LibraryController } from './library.controller';

const useCase = <T>(Ctor: new (r: ExerciseLibraryRepository) => T) => ({
  provide: Ctor,
  useFactory: (r: ExerciseLibraryRepository) => new Ctor(r),
  inject: [ExerciseLibraryRepository],
});

@Module({
  controllers: [LibraryController],
  providers: [
    { provide: ExerciseLibraryRepository, useFactory: (db: Db) => new SqliteExerciseLibraryRepository(db), inject: [DB] },
    useCase(ListExercisesUseCase),
    useCase(GetExerciseUseCase),
    useCase(CreateCustomExerciseUseCase),
    useCase(UpdateCustomExerciseUseCase),
    useCase(ArchiveCustomExerciseUseCase),
  ],
})
export class LibraryModule {}
