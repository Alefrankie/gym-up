import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  analyzeMealRequestSchema,
  calorieGoalSchema,
  logMealRequestSchema,
  type AnalyzeMealRequest,
  type AnalyzeMealResponse,
  type CalorieGoalDto,
  type DailySummaryDto,
  type LogMealRequest,
  type NutritionEntryDto,
} from '@gym-up/contracts';
import type { User } from '@/lib/contexts/auth/auth.types';
import { AnalyzeMealUseCase } from '@/lib/contexts/nutrition/application/analyze-meal.use-case';
import { GetDailyCalorieSummaryUseCase } from '@/lib/contexts/nutrition/application/get-daily-calorie-summary.use-case';
import { GetNutritionHistoryUseCase } from '@/lib/contexts/nutrition/application/get-nutrition-history.use-case';
import { LogMealUseCase, formatOfMealKey } from '@/lib/contexts/nutrition/application/log-meal.use-case';
import { SetCalorieGoalUseCase } from '@/lib/contexts/nutrition/application/set-calorie-goal.use-case';
import { NutritionEntryRepository } from '@/lib/contexts/nutrition/domain/nutrition-entry-repository';
import { NutritionGoalRepository } from '@/lib/contexts/nutrition/domain/nutrition-goal-repository';
import { ContentTypes } from '@/lib/contexts/nutrition/domain/nutrition.types';
import {
  PhotoSizeExceededError,
  UnsupportedPhotoFormatError,
} from '@/lib/contexts/private-photos/application/photos.use-cases';
import { PhotoRules } from '@/lib/contexts/private-photos/domain/private-photos.types';
import type { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AI_ANALYSIS, PHOTO_STORAGE } from '../tokens';
import { FORMAT_BY_MIME, decodeBase64, toAnalysisDto, toEntryDto, toFoodItems } from './nutrition.mappers';

interface ResponseLike {
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

@Controller('nutrition')
@UseGuards(AuthGuard)
export class NutritionController {
  constructor(
    @Inject(AI_ANALYSIS) private readonly aiAvailable: boolean,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage | null,
    @Inject(AnalyzeMealUseCase) private readonly analyze: AnalyzeMealUseCase,
    @Inject(LogMealUseCase) private readonly logMeal: LogMealUseCase,
    @Inject(GetNutritionHistoryUseCase) private readonly history: GetNutritionHistoryUseCase,
    @Inject(GetDailyCalorieSummaryUseCase) private readonly summary: GetDailyCalorieSummaryUseCase,
    @Inject(SetCalorieGoalUseCase) private readonly setGoal: SetCalorieGoalUseCase,
    @Inject(NutritionEntryRepository) private readonly entries: NutritionEntryRepository,
    @Inject(NutritionGoalRepository) private readonly goals: NutritionGoalRepository,
  ) {}

  private decodeImage(imageBase64: string, mimeType: string) {
    const format = FORMAT_BY_MIME[mimeType];
    if (!format) throw new UnsupportedPhotoFormatError(mimeType);
    const bytes = decodeBase64(imageBase64);
    if (bytes.byteLength > PhotoRules.MaxSizeBytes) throw new PhotoSizeExceededError(bytes.byteLength);
    return { bytes, format };
  }

  /** Estimates calories and macros from a (device-compressed) photo. 503 until a Gemini key is configured. */
  @Post('analyze')
  @HttpCode(200)
  async analyzeMeal(
    @Body(new ZodValidationPipe(analyzeMealRequestSchema)) body: AnalyzeMealRequest,
  ): Promise<AnalyzeMealResponse> {
    if (!this.aiAvailable) throw new ServiceUnavailableException('Meal analysis is not configured');
    const image = this.decodeImage(body.imageBase64, body.mimeType);
    return toAnalysisDto(await this.analyze.execute(image));
  }

  @Post('entries')
  @HttpCode(200)
  async log(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(logMealRequestSchema)) body: LogMealRequest,
  ): Promise<NutritionEntryDto> {
    const image = body.imageBase64 && body.mimeType ? this.decodeImage(body.imageBase64, body.mimeType) : undefined;
    const { entry } = await this.logMeal.execute({
      userId: user.id,
      id: body.id,
      totalCalories: body.totalCalories,
      totalProtein: body.totalProtein,
      totalCarbs: body.totalCarbs,
      totalFat: body.totalFat,
      foodItems: toFoodItems(body),
      userEdited: body.userEdited,
      image,
    });
    return toEntryDto(entry);
  }

  @Get('entries')
  async list(@CurrentUser() user: User, @Query('limit') limit?: string): Promise<NutritionEntryDto[]> {
    const n = Number.parseInt(limit ?? '50', 10);
    const entries = await this.history.execute({ userId: user.id, limit: Number.isFinite(n) ? Math.min(Math.max(n, 1), 200) : 50 });
    return entries.map(toEntryDto);
  }

  @Get('entries/:id/photo')
  async photo(@CurrentUser() user: User, @Param('id') id: string, @Res() res: ResponseLike): Promise<void> {
    const entry = await this.entries.findById(id, user.id).catch(() => undefined);
    const format = entry ? formatOfMealKey(entry.storagePath) : null;
    if (!entry || !format || !this.storage) throw new NotFoundException('Photo not found');
    const object = await this.storage.get(entry.storagePath);
    if (!object) throw new NotFoundException('Photo not found');
    res.setHeader('content-type', ContentTypes[format]);
    res.setHeader('cache-control', 'private, max-age=3600');
    res.send(Buffer.from(object.bytes));
  }

  @Delete('entries/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    const entry = await this.entries.findById(id, user.id).catch(() => undefined);
    if (!entry) throw new NotFoundException('Entry not found');
    await this.entries.delete(id, user.id);
    if (entry.storagePath && this.storage) await this.storage.delete(entry.storagePath);
  }

  @Get('summary')
  async dailySummary(@CurrentUser() user: User): Promise<DailySummaryDto> {
    return this.summary.execute({ userId: user.id });
  }

  @Get('goal')
  async goal(@CurrentUser() user: User): Promise<CalorieGoalDto> {
    return { dailyCalorieGoal: (await this.goals.getGoal(user.id))?.dailyCalorieGoal ?? null };
  }

  @Put('goal')
  async updateGoal(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(calorieGoalSchema)) body: CalorieGoalDto,
  ): Promise<CalorieGoalDto> {
    await this.setGoal.execute({ userId: user.id, goal: body.dailyCalorieGoal });
    return { dailyCalorieGoal: body.dailyCalorieGoal };
  }
}
