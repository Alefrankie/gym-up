import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Put,
  Query,
  Res,
  ServiceUnavailableException,
  UseGuards,
  Body,
} from '@nestjs/common';
import { idSchema, type PhotoDto } from '@gym-up/contracts';
import type { User } from '@/lib/contexts/auth/auth.types';
import {
  GetPhotoFileUseCase,
  ListMyPhotosUseCase,
  RemovePhotoUseCase,
  StorePhotoUseCase,
  formatOfKey,
} from '@/lib/contexts/private-photos/application/photos.use-cases';
import { ContentTypes } from '@/lib/contexts/private-photos/domain/private-photos.types';
import type { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PHOTO_STORAGE } from '../tokens';

interface ResponseLike {
  status(code: number): ResponseLike;
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

/**
 * Private progress photos (ADR-005): every route is owner-only. When no object store is configured
 * (no R2 bucket bound) every route answers 503 so the rest of the API keeps working.
 */
@Controller('photos')
@UseGuards(AuthGuard)
export class PhotosController {
  constructor(
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage | null,
    @Inject(StorePhotoUseCase) private readonly store: StorePhotoUseCase,
    @Inject(ListMyPhotosUseCase) private readonly list: ListMyPhotosUseCase,
    @Inject(GetPhotoFileUseCase) private readonly getFile: GetPhotoFileUseCase,
    @Inject(RemovePhotoUseCase) private readonly remove: RemovePhotoUseCase,
  ) {}

  private requireStorage(): void {
    if (!this.storage) throw new ServiceUnavailableException('Photo storage is not configured');
  }

  @Get()
  async mine(@CurrentUser() user: User): Promise<PhotoDto[]> {
    this.requireStorage();
    const photos = await this.list.execute(user.id);
    return photos.map((p) => ({
      id: p.id,
      photoDate: p.photoDate.toISOString(),
      caption: p.caption,
      contentType: ContentTypes[formatOfKey(p.storagePath)] as PhotoDto['contentType'],
    }));
  }

  /** Upload raw image bytes. Idempotent by the client-generated id: replaying the request returns the stored photo. */
  @Put(':id')
  async upload(
    @CurrentUser() user: User,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Headers('content-type') contentType: string | undefined,
    @Query('caption') caption: string | undefined,
    @Body() body: unknown,
    @Res() res: ResponseLike,
  ): Promise<void> {
    this.requireStorage();
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(0);
    const { photo, created } = await this.store.execute({
      userId: user.id,
      id,
      bytes,
      contentType: (contentType ?? '').split(';')[0]!.trim().toLowerCase(),
      caption,
    });
    const dto: PhotoDto = {
      id: photo.id,
      photoDate: photo.photoDate.toISOString(),
      caption: photo.caption,
      contentType: ContentTypes[formatOfKey(photo.storagePath)] as PhotoDto['contentType'],
    };
    res.status(created ? 201 : 200).setHeader('content-type', 'application/json');
    res.send(JSON.stringify(dto));
  }

  @Get(':id/file')
  async file(@CurrentUser() user: User, @Param('id') id: string, @Res() res: ResponseLike): Promise<void> {
    this.requireStorage();
    const { bytes, contentType } = await this.getFile.execute(user.id, id);
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'private, max-age=3600');
    res.send(Buffer.from(bytes));
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    this.requireStorage();
    await this.remove.execute(user.id, id);
  }
}
