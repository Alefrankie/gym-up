import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  createExerciseRequestSchema,
  updateExerciseRequestSchema,
  type CreateExerciseRequest,
  type LibraryExerciseDto,
  type LibraryExerciseListResponse,
  type UpdateExerciseRequest,
} from '@gym-up/contracts';
import type { Exercise } from '@db/schema';
import type { User } from '@/lib/contexts/auth/auth.types';
import {
  ArchiveCustomExerciseUseCase,
  CreateCustomExerciseUseCase,
  GetExerciseUseCase,
  ListExercisesUseCase,
  UpdateCustomExerciseUseCase,
} from '@/lib/contexts/exercise-library/application/exercise-library.use-cases';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

export function toLibraryExerciseDto(e: Exercise): LibraryExerciseDto {
  let secondary: string[] = [];
  try {
    secondary = JSON.parse(e.secondaryMuscles) as string[];
  } catch {
    secondary = [];
  }
  return {
    id: e.id,
    name: e.name,
    primaryMuscle: e.muscleGroup,
    secondaryMuscles: secondary,
    equipment: e.equipment,
    exerciseType: e.exerciseType,
    instructions: e.instructions,
    videoUrl: e.videoUrl,
    isCustom: e.ownerId !== null,
    ownerId: e.ownerId,
    isArchived: e.isArchived,
  };
}

const toPatch = (b: UpdateExerciseRequest) => ({
  ...(b.name !== undefined && { name: b.name }),
  ...(b.primaryMuscle !== undefined && { muscleGroup: b.primaryMuscle }),
  ...(b.secondaryMuscles !== undefined && { secondaryMuscles: b.secondaryMuscles }),
  ...(b.equipment !== undefined && { equipment: b.equipment }),
  ...(b.exerciseType !== undefined && { exerciseType: b.exerciseType }),
  ...(b.instructions !== undefined && { instructions: b.instructions ?? null }),
  ...(b.videoUrl !== undefined && { videoUrl: b.videoUrl ?? null }),
});

@Controller('exercises')
@UseGuards(AuthGuard)
export class LibraryController {
  constructor(
    @Inject(ListExercisesUseCase) private readonly list: ListExercisesUseCase,
    @Inject(GetExerciseUseCase) private readonly get: GetExerciseUseCase,
    @Inject(CreateCustomExerciseUseCase) private readonly create: CreateCustomExerciseUseCase,
    @Inject(UpdateCustomExerciseUseCase) private readonly update: UpdateCustomExerciseUseCase,
    @Inject(ArchiveCustomExerciseUseCase) private readonly archive: ArchiveCustomExerciseUseCase,
  ) {}

  @Get()
  async index(
    @CurrentUser() user: User,
    @Query('q') q?: string,
    @Query('muscle') muscle?: string,
    @Query('equipment') equipment?: string,
    @Query('mine') mine?: string,
  ): Promise<LibraryExerciseListResponse> {
    const rows = await this.list.execute({
      userId: user.id,
      q: q?.trim() || undefined,
      muscle: muscle || undefined,
      equipment: equipment || undefined,
      mine: mine === 'true' || mine === '1',
    });
    return { items: rows.map(toLibraryExerciseDto) };
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<LibraryExerciseDto> {
    return toLibraryExerciseDto(await this.get.execute(id));
  }

  /** Idempotent by the client `id`: replaying an offline create returns the stored exercise. */
  @Post()
  @HttpCode(200)
  async add(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createExerciseRequestSchema)) body: CreateExerciseRequest,
  ): Promise<LibraryExerciseDto> {
    const row = await this.create.execute(user.id, body.id ?? crypto.randomUUID(), {
      name: body.name,
      muscleGroup: body.primaryMuscle,
      secondaryMuscles: body.secondaryMuscles,
      equipment: body.equipment,
      exerciseType: body.exerciseType,
      instructions: body.instructions,
      videoUrl: body.videoUrl,
    });
    return toLibraryExerciseDto(row);
  }

  @Patch(':id')
  async edit(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExerciseRequestSchema)) body: UpdateExerciseRequest,
  ): Promise<LibraryExerciseDto> {
    return toLibraryExerciseDto(await this.update.execute(user.id, id, toPatch(body)));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.archive.execute(user.id, id);
  }
}
