import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import {
  GetPhotoFileUseCase,
  ListMyPhotosUseCase,
  RemovePhotoUseCase,
  StorePhotoUseCase,
} from '@/lib/contexts/private-photos/application/photos.use-cases';
import type { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import { InMemoryPhotoStorage } from '@/lib/contexts/private-photos/infrastructure/in-memory-photo-storage';
import { PhotoRepository } from '@/lib/contexts/workout-tracking/domain/photo.repository';
import { SqlitePhotoRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository';
import { DB, PHOTO_STORAGE } from '../tokens';
import { PhotosController } from './photos.controller';

// When no store is bound the use cases still need a PhotoStorage to construct; the controller answers 503 first.
const unconfigured: PhotoStorage = new InMemoryPhotoStorage();

@Module({
  controllers: [PhotosController],
  providers: [
    { provide: PhotoRepository, useFactory: (db: Db) => new SqlitePhotoRepository(db), inject: [DB] },
    { provide: StorePhotoUseCase, useFactory: (r: PhotoRepository, s: PhotoStorage | null) => new StorePhotoUseCase(r, s ?? unconfigured), inject: [PhotoRepository, PHOTO_STORAGE] },
    { provide: ListMyPhotosUseCase, useFactory: (r: PhotoRepository) => new ListMyPhotosUseCase(r), inject: [PhotoRepository] },
    { provide: GetPhotoFileUseCase, useFactory: (r: PhotoRepository, s: PhotoStorage | null) => new GetPhotoFileUseCase(r, s ?? unconfigured), inject: [PhotoRepository, PHOTO_STORAGE] },
    { provide: RemovePhotoUseCase, useFactory: (r: PhotoRepository, s: PhotoStorage | null) => new RemovePhotoUseCase(r, s ?? unconfigured), inject: [PhotoRepository, PHOTO_STORAGE] },
  ],
})
export class PhotosModule {}
