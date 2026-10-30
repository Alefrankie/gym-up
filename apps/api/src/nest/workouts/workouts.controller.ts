import {
  BadRequestException,
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
  UseGuards,
} from '@nestjs/common';
import {
  startWorkoutRequestSchema,
  upsertSetRequestSchema,
  type StartWorkoutRequest,
  type StartWorkoutResponse,
  type TodayWorkoutResponse,
  type UpsertSetRequest,
  type WorkoutDetailDto,
  type WorkoutDto,
  type WorkoutEntryDto,
  type WorkoutHistoryResponse,
} from '@gym-up/contracts';
import { and, eq, gt, sql } from 'drizzle-orm';
import { workoutEntries, workouts } from '@db/schema';
import type { Db } from '@/lib/db/client';
import type { User } from '@/lib/contexts/auth/auth.types';
import { DB } from '../tokens';
import { DiscardWorkoutUseCase } from '@/lib/contexts/workout-tracking/application/discard-workout.use-case';
import { CompleteWorkoutUseCase } from '@/lib/contexts/workout-tracking/application/complete-workout.use-case';
import { GetNextWorkoutUseCase, type NextWorkoutResult } from '@/lib/contexts/routines/application/get-next-workout.use-case';
import { GetWorkoutDetailUseCase } from '@/lib/contexts/workout-tracking/application/get-workout-detail.use-case';
import { GetWorkoutHistoryUseCase } from '@/lib/contexts/workout-tracking/application/get-workout-history.use-case';
import { LogSetUseCase } from '@/lib/contexts/workout-tracking/application/log-set.use-case';
import { StartWorkoutUseCase } from '@/lib/contexts/workout-tracking/application/start-workout.use-case';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { toWorkoutDto, toWorkoutEntryDto } from '../mappers';

const iso = (d: Date) => d.toISOString();
const parseMuscles = (json: string): string[] => {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
};

/**
 * A workout done on an earlier day is dated at noon UTC of that day, so it lands on that calendar day for
 * every time zone the app is used in. Future days and days older than 60 are refused.
 */
function pastDay(day: string | undefined): Date | undefined {
  if (!day) return undefined;
  const at = new Date(`${day}T12:00:00Z`);
  const ageDays = (Date.now() - at.getTime()) / 86_400_000;
  if (Number.isNaN(at.getTime()) || ageDays < -1 || ageDays > 60) {
    throw new BadRequestException('date must be a day within the last 60 days');
  }
  return at;
}

@Controller('workouts')
@UseGuards(AuthGuard)
export class WorkoutsController {
  constructor(
    @Inject(StartWorkoutUseCase) private readonly startWorkout: StartWorkoutUseCase,
    @Inject(LogSetUseCase) private readonly logSet: LogSetUseCase,
    @Inject(DiscardWorkoutUseCase) private readonly discardWorkout: DiscardWorkoutUseCase,
    @Inject(CompleteWorkoutUseCase) private readonly completeWorkout: CompleteWorkoutUseCase,
    @Inject(GetNextWorkoutUseCase) private readonly getToday: GetNextWorkoutUseCase,
    @Inject(GetWorkoutDetailUseCase) private readonly getDetail: GetWorkoutDetailUseCase,
    @Inject(GetWorkoutHistoryUseCase) private readonly getHistory: GetWorkoutHistoryUseCase,
    @Inject(DB) private readonly db: Db,
  ) {}

  /** What the dashboard shows for today. */
  @Get('today')
  async today(@CurrentUser() user: User): Promise<TodayWorkoutResponse> {
    return this.toResponse(user, await this.getToday.execute({ userId: user.id, routineType: user.routineType }));
  }

  /** Any routine of a program the caller can see, to start it on any day. */
  @Get('routine/:routineDayId')
  async routine(@CurrentUser() user: User, @Param('routineDayId') routineDayId: string): Promise<TodayWorkoutResponse> {
    return this.toResponse(user, await this.getToday.forRoutine({ userId: user.id, routineDayId }));
  }

  private toResponse(user: User, result: NextWorkoutResult): TodayWorkoutResponse {
    if (result.kind === 'no_routine') return { kind: 'no_routine' };
    return {
      kind: 'workout_day',
      routineDay: {
        id: result.routineDay.id,
        dayNumber: result.routineDay.dayNumber,
        dayName: result.routineDay.dayName,
        focus: result.routineDay.focus,
      },
      exercises: result.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        exerciseName: e.exercise.name,
        muscleGroup: e.exercise.muscleGroup,
        secondaryMuscles: parseMuscles(e.exercise.secondaryMuscles),
        equipment: e.exercise.equipment,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        last: result.last[e.exerciseId] ?? null,
        warmupSets: e.warmupSets,
        restSeconds: e.restSeconds,
        exerciseOrder: e.exerciseOrder,
        sets: e.setPlan ?? null,
      })),
      workoutStatus: result.workoutStatus,
      existingWorkoutId: result.existingWorkoutId,
      weightUnit: user.weightUnit,
      dayNumber: result.dayNumber,
      programName: result.programName,
      week: result.week,
    };
  }

  @Get()
  async history(@CurrentUser() user: User, @Query('page') page?: string): Promise<WorkoutHistoryResponse> {
    const parsed = Number.parseInt(page ?? '1', 10);
    const result = await this.getHistory.execute({
      userId: user.id,
      page: Number.isFinite(parsed) ? parsed : 1,
    });
    return {
      items: result.items.map((i) => ({ ...i, workoutDate: iso(i.workoutDate) })),
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  /** Start (or resume) a workout. Idempotent by the client-generated `id` (ADR-025). */
  @Post()
  @HttpCode(200)
  async start(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(startWorkoutRequestSchema)) body: StartWorkoutRequest,
  ): Promise<StartWorkoutResponse> {
    const result = await this.startWorkout.execute({
      userId: user.id,
      id: body.id,
      routineDayId: body.routineDayId,
      existingWorkoutId: body.existingWorkoutId,
      now: pastDay(body.date),
    });
    return { kind: result.kind, workout: toWorkoutDto(result.workout) };
  }

  /** Cancels a workout in progress. Idempotent: an already-missing workout is fine. */
  @Delete(':id')
  @HttpCode(204)
  async discard(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.discardWorkout.execute({ userId: user.id, workoutId: id });
  }

  @Get(':id')
  async detail(@CurrentUser() user: User, @Param('id') id: string): Promise<WorkoutDetailDto> {
    const result = await this.getDetail.execute({ userId: user.id, workoutId: id });
    return { workout: toWorkoutDto(result.workout), entries: result.entries };
  }

  /** Log or edit one set. Replaying the same command is safe (ADR-025). */
  @Put(':id/sets')
  async upsertSet(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertSetRequestSchema)) body: UpsertSetRequest,
  ): Promise<WorkoutEntryDto> {
    const result = await this.logSet.execute({
      userId: user.id,
      workoutId: id,
      id: body.id,
      exerciseId: body.exerciseId,
      setNumber: body.setNumber,
      reps: body.reps,
      weight: body.weight,
      weightUnit: body.weightUnit,
      completed: body.completed,
      notes: body.notes,
      setType: body.setType,
    });
    return toWorkoutEntryDto(result.entry);
  }

  /** Removes one set; later sets of that exercise move up one number. Replaying it after the shift is a no-op only if nothing was logged there since. */
  @Delete(':id/sets/:exerciseId/:setNumber')
  @HttpCode(204)
  async removeSet(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('exerciseId') exerciseId: string,
    @Param('setNumber') setNumberParam: string,
  ): Promise<void> {
    const setNumber = Number.parseInt(setNumberParam, 10);
    if (!Number.isInteger(setNumber) || setNumber < 1) throw new BadRequestException('setNumber must be a positive integer');
    const [owned] = await this.db.select({ id: workouts.id }).from(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, user.id))).limit(1);
    if (!owned) throw new NotFoundException('Workout not found');
    const sameExercise = and(eq(workoutEntries.workoutId, id), eq(workoutEntries.exerciseId, exerciseId));
    await this.db.delete(workoutEntries).where(and(sameExercise, eq(workoutEntries.setNumber, setNumber)));
    await this.db.update(workoutEntries).set({ setNumber: sql`${workoutEntries.setNumber} - 1` }).where(and(sameExercise, gt(workoutEntries.setNumber, setNumber)));
  }

  @Post(':id/complete')
  @HttpCode(200)
  async complete(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { durationSeconds?: unknown } | undefined,
  ): Promise<WorkoutDto> {
    const d = body?.durationSeconds;
    const durationSeconds = typeof d === 'number' && Number.isFinite(d) && d > 0 ? Math.round(d) : undefined;
    const { workout } = await this.completeWorkout.execute({ userId: user.id, workoutId: id, durationSeconds });
    return toWorkoutDto(workout);
  }
}
