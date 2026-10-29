import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  addSupplementRequestSchema,
  daySchema,
  markSupplementRequestSchema,
  type AddSupplementRequest,
  type MarkSupplementRequest,
  type SupplementDto,
  type SupplementListResponse,
} from '@gym-up/contracts';
import type { User } from '@/lib/contexts/auth/auth.types';
import {
  AddSupplementUseCase,
  GetSupplementsUseCase,
  MarkSupplementUseCase,
  RemoveSupplementUseCase,
  minusDays,
  type SupplementDay,
} from '@/lib/contexts/supplements/application/supplement.use-cases';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/** Days of history sent with the checklist: enough for a month chart and any realistic streak shown. */
const WINDOW = 60;

function toDto(s: SupplementDay, day: string): SupplementDto {
  const taken = new Set(s.days);
  let streak = 0;
  let cursor = taken.has(day) ? day : minusDays(day, 1);
  while (taken.has(cursor)) {
    streak++;
    cursor = minusDays(cursor, 1);
  }
  return { id: s.supplement.id, name: s.supplement.name, taken: taken.has(day), days: s.days, streak };
}

/** The daily supplement checklist (creatine, protein, pre-workout…). Private to its owner. */
@Controller('supplements')
@UseGuards(AuthGuard)
export class SupplementsController {
  constructor(
    @Inject(GetSupplementsUseCase) private readonly list: GetSupplementsUseCase,
    @Inject(AddSupplementUseCase) private readonly add: AddSupplementUseCase,
    @Inject(RemoveSupplementUseCase) private readonly remove: RemoveSupplementUseCase,
    @Inject(MarkSupplementUseCase) private readonly mark: MarkSupplementUseCase,
  ) {}

  /** `day` is the user's local date; the server does not guess time zones. */
  @Get()
  async today(@CurrentUser() user: User, @Query('day') day?: string): Promise<SupplementListResponse> {
    const parsed = daySchema.safeParse(day);
    if (!parsed.success) throw new BadRequestException('day must be YYYY-MM-DD');
    const items = await this.list.execute({ userId: user.id, day: parsed.data, window: WINDOW });
    return { day: parsed.data, items: items.map((s) => toDto(s, parsed.data)) };
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(addSupplementRequestSchema)) body: AddSupplementRequest,
  ): Promise<{ id: string; name: string }> {
    const s = await this.add.execute({ userId: user.id, id: body.id, name: body.name });
    return { id: s.id, name: s.name };
  }

  @Delete(':id')
  @HttpCode(204)
  async archive(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.remove.execute({ userId: user.id, id });
  }

  @Put(':id/log')
  @HttpCode(204)
  async log(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(markSupplementRequestSchema)) body: MarkSupplementRequest,
  ): Promise<void> {
    await this.mark.execute({ userId: user.id, id, day: body.day, taken: body.taken });
  }
}
