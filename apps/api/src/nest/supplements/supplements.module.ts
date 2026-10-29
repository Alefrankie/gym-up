import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import {
  AddSupplementUseCase,
  GetSupplementsUseCase,
  MarkSupplementUseCase,
  RemoveSupplementUseCase,
} from '@/lib/contexts/supplements/application/supplement.use-cases';
import { SupplementRepository } from '@/lib/contexts/supplements/domain/supplement.repository';
import { SqliteSupplementRepository } from '@/lib/contexts/supplements/infrastructure/sqlite/sqlite-supplement.repository';
import { DB } from '../tokens';
import { SupplementsController } from './supplements.controller';

@Module({
  controllers: [SupplementsController],
  providers: [
    { provide: SupplementRepository, useFactory: (db: Db) => new SqliteSupplementRepository(db), inject: [DB] },
    ...[GetSupplementsUseCase, AddSupplementUseCase, RemoveSupplementUseCase, MarkSupplementUseCase].map((Ctor) => ({
      provide: Ctor,
      useFactory: (r: SupplementRepository) => new Ctor(r),
      inject: [SupplementRepository],
    })),
  ],
})
export class SupplementsModule {}
