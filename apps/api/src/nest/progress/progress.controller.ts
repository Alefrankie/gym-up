import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import {
  dateRangeSchema,
  type CalendarDayDto,
  type ChartPointDto,
  type ExerciseDto,
  type StreakDto,
} from '@gym-up/contracts';
import type { User } from '@/lib/contexts/auth/auth.types';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/calculate-streak.use-case';
import { GetCalendarDataUseCase } from '@/lib/contexts/progress/application/get-calendar-data.use-case';
import { GetExerciseHistoryUseCase } from '@/lib/contexts/progress/application/get-exercise-history.use-case';
import { GetExerciseListUseCase } from '@/lib/contexts/progress/application/get-exercise-list.use-case';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('progress')
@UseGuards(AuthGuard)
export class ProgressController {
  constructor(
    @Inject(GetExerciseListUseCase) private readonly exerciseList: GetExerciseListUseCase,
    @Inject(GetExerciseHistoryUseCase) private readonly history: GetExerciseHistoryUseCase,
    @Inject(CalculateStreakUseCase) private readonly streak: CalculateStreakUseCase,
    @Inject(GetCalendarDataUseCase) private readonly calendar: GetCalendarDataUseCase,
  ) {}

  /** Exercises the user has logged at least once. */
  @Get('exercises')
  async exercises(@CurrentUser() user: User): Promise<ExerciseDto[]> {
    const list = await this.exerciseList.execute({ userId: user.id });
    return list.map((e) => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup }));
  }

  @Get('exercises/:id/history')
  async exerciseHistory(
    @CurrentUser() user: User,
    @Param('id') exerciseId: string,
    @Query('range', new ZodValidationPipe(dateRangeSchema.default('30d'))) range: '7d' | '30d' | 'all',
  ): Promise<ChartPointDto[]> {
    return this.history.execute({ userId: user.id, exerciseId, range });
  }

  @Get('streak')
  async currentStreak(@CurrentUser() user: User): Promise<StreakDto> {
    return this.streak.execute({ userId: user.id });
  }

  @Get('calendar')
  async calendarDays(@CurrentUser() user: User): Promise<CalendarDayDto[]> {
    return this.calendar.execute({ userId: user.id });
  }
}
