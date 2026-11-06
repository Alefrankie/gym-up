import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  createRecipeRequestSchema,
  logRecipeRequestSchema,
  rateRecipeRequestSchema,
  recipeQuerySchema,
  updateRecipeRequestSchema,
  uploadRecipePhotoRequestSchema,
  type CreateRecipeRequest,
  type LikeStateDto,
  type LogRecipeRequest,
  type LogRecipeResponse,
  type RateRecipeRequest,
  type RecipeDetailDto,
  type RecipePageDto,
  type RecipePhotoDto,
  type RecipeQuery,
  type RecipeRatingStatesDto,
  type UpdateRecipeRequest,
  type UploadRecipePhotoRequest,
} from '@gym-up/contracts';
import type { User } from '@/lib/contexts/auth/auth.types';
import { RecipesUseCases } from '@/lib/contexts/recipes/application/recipes.use-cases';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

interface ResponseLike {
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Recipes (DR-0029): every signed-in member reads, likes and rates every published recipe. An author cannot
 * like or rate their own, nobody can comment, and a recipe without a cover photo is a draft its author alone
 * can see. The acting user always comes from the session.
 */
@Controller('recipes')
@UseGuards(AuthGuard)
export class RecipesController {
  constructor(@Inject(RecipesUseCases) private readonly recipes: RecipesUseCases) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(recipeQuerySchema)) query: RecipeQuery,
  ): Promise<RecipePageDto> {
    return this.recipes.list(user.id, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: User, @Param('id') id: string): Promise<RecipeDetailDto> {
    return this.recipes.detail(user.id, id);
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createRecipeRequestSchema)) body: CreateRecipeRequest,
  ): Promise<RecipeDetailDto> {
    return this.recipes.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRecipeRequestSchema)) body: UpdateRecipeRequest,
  ): Promise<RecipeDetailDto> {
    return this.recipes.update(user.id, id, body);
  }

  @Put(':id/like')
  @HttpCode(200)
  like(@CurrentUser() user: User, @Param('id') id: string): Promise<LikeStateDto> {
    return this.recipes.like(user.id, id);
  }

  @Delete(':id/like')
  @HttpCode(200)
  unlike(@CurrentUser() user: User, @Param('id') id: string): Promise<LikeStateDto> {
    return this.recipes.unlike(user.id, id);
  }

  @Put(':id/rating')
  @HttpCode(200)
  rate(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rateRecipeRequestSchema)) body: RateRecipeRequest,
  ): Promise<RecipeRatingStatesDto> {
    return this.recipes.rate(user.id, id, body.rating);
  }

  /** "Añadir a hoy": the recipe becomes one meal in the calorie log. */
  @Post(':id/log')
  @HttpCode(200)
  log(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(logRecipeRequestSchema)) body: LogRecipeRequest,
  ): Promise<LogRecipeResponse> {
    return this.recipes.log(user.id, id, body);
  }

  /** `stepOrder` null uploads the cover, which is what publishes the recipe. */
  @Post(':id/photos')
  @HttpCode(201)
  putPhoto(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(uploadRecipePhotoRequestSchema)) body: UploadRecipePhotoRequest,
  ): Promise<RecipePhotoDto> {
    return this.recipes.putPhoto(user.id, id, body.stepOrder, decodeBase64(body.imageBase64), body.mimeType);
  }

  @Get(':id/photos/:photoId/file')
  async photo(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Res() res: ResponseLike,
  ): Promise<void> {
    const photo = await this.recipes.photo(id, photoId, user.id);
    res.setHeader('content-type', photo.contentType);
    res.setHeader('cache-control', 'private, max-age=3600');
    res.send(Buffer.from(photo.bytes));
  }
}
