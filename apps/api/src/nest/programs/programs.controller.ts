import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
  createProgramRequestSchema,
  saveProgramRequestSchema,
  type CreateProgramRequest,
  type ProgramDetailDto,
  type ProgramListResponse,
  type ProgramSummaryDto,
  type SaveProgramRequest,
} from '@gym-up/contracts';
import type { Routine } from '@db/schema';
import type { User } from '@/lib/contexts/auth/auth.types';
import {
  ActivateProgramUseCase,
  AdoptProgramUseCase,
  ArchiveProgramUseCase,
  CreateProgramUseCase,
  GetProgramUseCase,
  ListProgramsUseCase,
  SaveProgramUseCase,
} from '@/lib/contexts/routines/application/program.use-cases';
import type { ProgramStats, ProgramTree } from '@/lib/contexts/routines/domain/program.repository';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

const parseMuscles = (json: string): string[] => {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
};

const summary = (p: Routine, routineCount: number, stats?: ProgramStats): ProgramSummaryDto => ({
  id: p.id,
  name: p.name,
  description: p.description,
  level: p.level,
  goal: p.goal,
  daysPerWeek: p.daysPerWeek,
  isTemplate: p.isTemplate,
  routineCount,
  sourceTemplateId: p.sourceTemplateId,
  exerciseCount: stats?.exerciseCount ?? 0,
  setCount: stats?.setCount ?? 0,
  muscles: stats?.muscles ?? [],
});

export function toProgramDetailDto(tree: ProgramTree): ProgramDetailDto {
  return {
    ...summary(tree.program, tree.routines.length),
    routines: tree.routines.map((r) => ({
      id: r.day.id,
      dayNumber: r.day.dayNumber,
      name: r.day.dayName,
      focus: r.day.focus,
      notes: r.day.notes,
      exercises: r.slots.map((s) => ({
        id: s.id,
        exerciseId: s.exerciseId,
        exerciseName: s.exercise.name,
        muscleGroup: s.exercise.muscleGroup,
        secondaryMuscles: parseMuscles(s.exercise.secondaryMuscles),
        targetSets: s.targetSets,
        targetReps: s.targetReps,
        warmupSets: s.warmupSets,
        restSeconds: s.restSeconds,
        notes: s.notes,
        sets: s.setPlan ?? null,
      })),
    })),
  };
}

@Controller('programs')
@UseGuards(AuthGuard)
export class ProgramsController {
  constructor(
    @Inject(ListProgramsUseCase) private readonly list: ListProgramsUseCase,
    @Inject(GetProgramUseCase) private readonly get: GetProgramUseCase,
    @Inject(AdoptProgramUseCase) private readonly adopt: AdoptProgramUseCase,
    @Inject(CreateProgramUseCase) private readonly create: CreateProgramUseCase,
    @Inject(SaveProgramUseCase) private readonly save: SaveProgramUseCase,
    @Inject(ArchiveProgramUseCase) private readonly archive: ArchiveProgramUseCase,
    @Inject(ActivateProgramUseCase) private readonly activate: ActivateProgramUseCase,
  ) {}

  @Get()
  async index(@CurrentUser() user: User): Promise<ProgramListResponse> {
    const r = await this.list.execute(user.id);
    return {
      templates: r.templates.map((t) => summary(t.program, t.routineCount, t.stats)),
      mine: r.mine.map((t) => summary(t.program, t.routineCount, t.stats)),
      activeProgramId: r.activeProgramId,
    };
  }

  @Get(':id')
  async show(@CurrentUser() user: User, @Param('id') id: string): Promise<ProgramDetailDto> {
    return toProgramDetailDto(await this.get.execute(user.id, id));
  }

  /** Empty program, idempotent by the client `id`. */
  @Post()
  @HttpCode(200)
  async add(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createProgramRequestSchema)) body: CreateProgramRequest,
  ): Promise<ProgramDetailDto> {
    return toProgramDetailDto(await this.create.execute(user.id, body.id ?? crypto.randomUUID(), body));
  }

  /** Deep copy of a template (or of one of your own programs); the copy becomes the active program. */
  @Post(':id/adopt')
  @HttpCode(200)
  async adoptProgram(@CurrentUser() user: User, @Param('id') id: string): Promise<ProgramDetailDto> {
    return toProgramDetailDto(await this.adopt.execute(user.id, id));
  }

  @Post(':id/activate')
  @HttpCode(204)
  async activateProgram(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.activate.execute(user.id, id);
  }

  @Put(':id')
  async edit(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveProgramRequestSchema)) body: SaveProgramRequest,
  ): Promise<ProgramDetailDto> {
    return toProgramDetailDto(await this.save.execute(user.id, id, body));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.archive.execute(user.id, id);
  }
}
